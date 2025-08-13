from flask import Flask, jsonify, render_template, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, and_
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from geoalchemy2.functions import ST_MakeEnvelope, ST_Transform
from dotenv import load_dotenv
from flask_cors import CORS
from flask_caching import Cache
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration du cache
app.config['CACHE_TYPE'] = 'simple'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300
cache = Cache(app)

# Configuration de la base de données
app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Définition de la classe Inventaire
class Inventaire(db.Model):
    __tablename__ = 'Inventaire_complet'
    id = db.Column('id', db.Integer, primary_key=True)
    geom = db.Column(Geometry('POINT', srid=4326))
    Nilots = db.Column('n_ilots', db.String(254))
    NomEtabliss = db.Column('nom_etabli', db.String(254))
    Categorie = db.Column('categories', db.String(254))
    Sous_categorie = db.Column('sous_categ', db.String(254))
    Rubriques = db.Column('types_rubr', db.String(254))
    Description = db.Column('descriptio', db.String(254))
    Avenue = db.Column('adresses', db.String(254))
    Date = db.Column('time', db.String(254))

def serialize_inventaire(obj):
    if obj.geom:
        point = to_shape(obj.geom)
        coords = {'lat': point.y, 'lng': point.x}
    else:
        coords = None

    return {
        'id': obj.id,
        'geom': coords,
        'Nilots': obj.Nilots,
        'NomEtabliss': obj.NomEtabliss,
        'Categorie': obj.Categorie,
        'Sous_categorie': obj.Sous_categorie,
        'Rubriques': obj.Rubriques,
        'Description': obj.Description,
        'Avenue': obj.Avenue,
        'Date': obj.Date
    }

# Routes REST GET
@app.route('/api/inventaire', methods=['GET'])
def get_all_inventaire():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    items = Inventaire.query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify([serialize_inventaire(item) for item in items.items])


@app.route('/api/inventaire/<int:item_id>', methods=['GET'])
def get_inventaire(item_id):
    item = Inventaire.query.get_or_404(item_id)
    return jsonify(serialize_inventaire(item))

@app.route('/api/inventaire/geojson', methods=['GET'])
@cache.cached(timeout=300)
def get_geojson():
    try:
        categorie_filter = request.args.get('categorie')
        bbox_param = request.args.get('bbox')  # format: minx,miny,maxx,maxy

        # Requête optimisée (sélectionne uniquement les colonnes utiles)
        query = db.session.query(
            Inventaire.id,
            Inventaire.NomEtabliss,
            Inventaire.Categorie,
            Inventaire.Sous_categorie,
            Inventaire.Rubriques,
            Inventaire.Description,
            Inventaire.Avenue,
            func.ST_X(Inventaire.geom).label('lon'),
            func.ST_Y(Inventaire.geom).label('lat')
        ).filter(Inventaire.geom != None)

        if categorie_filter:
            query = query.filter(Inventaire.Categorie.ilike(f"%{categorie_filter}%"))

        if bbox_param:
            try:
                minx, miny, maxx, maxy = map(float, bbox_param.split(','))
                bbox_geom = ST_MakeEnvelope(minx, miny, maxx, maxy, 4326)
                query = query.filter(Inventaire.geom.ST_Within(bbox_geom))
            except ValueError:
                return jsonify({"error": "Paramètre bbox mal formé. Utilise : bbox=minx,miny,maxx,maxy"}), 400

        items = query.all()

        # Construire la collection GeoJSON
        features = []
        for item in items:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [item.lon, item.lat]
                },
                "properties": {
                    "id": item.id,
                    "nom_etabli": item.NomEtabliss,
                    "categories": item.Categorie,
                    "sous_categ": item.Sous_categorie,
                    "types_rubr": item.Rubriques,
                    "descriptio": item.Description,
                    "adresses": item.Avenue
                }
            })

        return jsonify({
            "type": "FeatureCollection",
            "features": features
        })

    except Exception as e:
        print(f"[ERREUR API GEOJSON] {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500
    
# API pour les statistiques des donnees
@app.route('/api/inventaire/stats', methods=['GET'])
def get_stats():
    results = db.session.query(Inventaire.Categorie, func.count(Inventaire.id)).group_by(Inventaire.Categorie).all()
    stats = [{"categorie": row[0], "count": row[1]} for row in results]
    return jsonify(stats)



# Route pour la page d'accueil
@app.route('/')
def homePage():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)

# if __name__ == "__main__":
#     port = int(os.environ.get('PORT', 5000))
#     app.run(host='0.0.0.0', port=port)

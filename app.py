from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
from geoalchemy2 import Geometry
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import shape, Point
from dotenv import load_dotenv
from flask_cors import CORS
from flask_caching import Cache
import requests
import os

load_dotenv()

# Configuration de la connexion a PostgreSQL/PostGIS
DB_URL = (
    f"postgresql+psycopg2://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)

app = Flask(__name__)
CORS(app)

# Configuration du cache
app.config['CACHE_TYPE'] = 'simple'  # Tu peux aussi utiliser 'filesystem' ou 'redis'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300  # 5 minutes (en secondes)
cache = Cache(app)


# Configuration de la base de données
app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Definition de la classe Inventaire dans la base de donnees
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
    point = to_shape(obj.geom)
    return {
        'id': obj.id,
        'geom': {'lat': point.y, 'lng': point.x},
        'Nilots': obj.N_ilots,
        'NomEtabliss': obj.NomEtabliss,
        'Categorie': obj.Categorie,
        'Sous_categorie': obj.Sous_categorie,
        'Rubriques': obj.Rubriques,
        'Description': obj.Description,
        'Avenue': obj.Avenue,
        'Date': obj.Date
    }

# Creation des routes Rest GET pour l'inventaire
@app.route('/api/inventaire', methods=['GET'])
def get_all_inventaire():
    items = Inventaire.query.all()
    return jsonify([serialize_inventaire(item) for item in items])

@app.route('/api/inventaire/<int:item_id>', methods=['GET'])
def get_inventaire(item_id):
    item = Inventaire.query.get_or_404(item_id)
    return jsonify(serialize_inventaire(item))

@app.route('/api/inventaire/geojson', methods=['GET'])
def get_geojson():
    items = Inventaire.query.all()
    features = []
    for item in items:
        point = to_shape(item.geom)
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [point.x, point.y]
            },
            "properties": {
                "id": item.id,
                "NomEtabliss": item.NomEtabliss,
                "Categorie": item.Categorie,
            }
        })
    return jsonify({"type": "FeatureCollection", "features": features})

# Route pour la page d'accueil
@app.route('/')
def homePage():
    return render_template('index.html')

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)

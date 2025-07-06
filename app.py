from flask import Flask, jsonify, request, render_template, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_caching import Cache
from geoalchemy2 import Geometry
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point
from functools import wraps
from dotenv import load_dotenv
import os

# Chargement des variables d'environnement
load_dotenv()

app = Flask(__name__)
CORS(app)  # Autoriser les requêtes cross-origin

# Configuration de la base de données PostgreSQL/PostGIS
app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"postgresql+psycopg2://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configuration du cache (ici simple en mémoire)
app.config['CACHE_TYPE'] = 'simple'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300  # 5 minutes

# Clé secrète pour les sessions Flask
app.secret_key = os.getenv("SECRET_KEY", "changeme")

# Initialisation des extensions
db = SQLAlchemy(app)
cache = Cache(app)

# Modèle SQLAlchemy représentant la table Inventaire_complet
class Inventaire(db.Model):
    __tablename__ = 'Inventaire_complet'
    id = db.Column('id', db.Integer, primary_key=True)
    geom = db.Column(Geometry('POINT', srid=4326))
    Nilots = db.Column('n° ilots', db.String(254))
    NomEtabliss = db.Column('nom_etabli', db.String(254))
    Categorie = db.Column('categories', db.String(254))
    Sous_categorie = db.Column('sous-categ ', db.String(254))
    Rubriques = db.Column('types_rubr ', db.String(254))
    Description = db.Column('descriptio', db.String(254))
    Avenue = db.Column('adresses', db.String(254))
    Date = db.Column('time', db.String(254))

# Fonction utilitaire pour transformer un objet en dictionnaire JSON
def serialize_inventaire(obj):
    point = to_shape(obj.geom)
    return {
        'id': obj.id,
        'geom': {'lat': point.y, 'lng': point.x},
        'Nilots': obj.Nilots,
        'NomEtabliss': obj.NomEtabliss,
        'Categorie': obj.Categorie,
        'Sous_categorie': obj.Sous_categorie,
        'Rubriques': obj.Rubriques,
        'Description': obj.Description,
        'Avenue': obj.Avenue,
        'Date': obj.Date
    }

# Décorateur pour restreindre certaines routes à l'administrateur
# def login_required(f):
#     @wraps(f)
#     def decorated_function(*args, **kwargs):
#         if session.get('logged_in') != True:
#             flash("Vous devez être connecté pour accéder à cette page.")
#             return redirect(url_for('login'))
#         return f(*args, **kwargs)
#     return decorated_function

# Route de connexion pour l'administrateur
# @app.route('/login', methods=['GET', 'POST'])
# def login():
#     if request.method == 'POST':
#         username = request.form['username']
#         password = request.form['password']
#         if username == os.getenv('ADMIN_USERNAME') and password == os.getenv('ADMIN_PASSWORD'):
#             session['logged_in'] = True
#             return redirect('/')
#         else:
#             flash("Identifiants incorrects")
#             return redirect('/login')
#     return render_template('login.html')

# # Route de déconnexion
# @app.route('/logout')
# def logout():
#     session.clear()
#     return redirect('/')

# Page d'accueil avec mise en cache
@app.route('/')
@cache.cached()
def homePage():
    return render_template('index.html')

# API REST - Obtenir tous les enregistrements de l'inventaire
@app.route('/api/inventaire', methods=['GET'])
def get_all_inventaire():
    items = Inventaire.query.all()
    return jsonify([serialize_inventaire(item) for item in items])

# API REST - Obtenir un enregistrement par ID
@app.route('/api/inventaire/<int:item_id>', methods=['GET'])
def get_inventaire(item_id):
    item = Inventaire.query.get_or_404(item_id)
    return jsonify(serialize_inventaire(item))

# API REST - Obtenir les données au format GeoJSON avec cache
@app.route('/api/inventaire/geojson', methods=['GET'])
@cache.cached()
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
                "Categorie": item.Categorie
            }
        })
    return jsonify({"type": "FeatureCollection", "features": features})

# API REST - Ajouter un nouvel enregistrement (admin uniquement)
# @app.route('/api/inventaire', methods=['POST'])
# @login_required
# def add_inventaire():
#     data = request.get_json()
#     if not data or 'geom' not in data or 'lat' not in data['geom'] or 'lng' not in data['geom']:
#         return jsonify({'error': 'Requête mal formée'}), 400
#     point = from_shape(Point(data['geom']['lng'], data['geom']['lat']), srid=4326)
#     item = Inventaire(
#         geom=point,
#         Nilots=data.get('Nilots'),
#         NomEtabliss=data.get('NomEtabliss'),
#         Categorie=data.get('Categorie'),
#         Sous_categorie=data.get('Sous_categorie'),
#         Rubriques=data.get('Rubriques'),
#         Description=data.get('Description'),
#         Avenue=data.get('Avenue'),
#         Date=data.get('Date')
#     )
#     db.session.add(item)
#     db.session.commit()
#     cache.delete('/api/inventaire/geojson')  # Invalider le cache
#     return jsonify(serialize_inventaire(item)), 201

# API REST - Modifier un enregistrement existant (admin uniquement)
# @app.route('/api/inventaire/<int:item_id>', methods=['PUT'])
# # @login_required
# def update_inventaire(item_id):
#     item = Inventaire.query.get_or_404(item_id)
#     data = request.get_json()
#     point = from_shape(Point(data['geom']['lng'], data['geom']['lat']), srid=4326)
#     item.geom = point
#     item.NomEtabliss = data.get('NomEtabliss', item.NomEtabliss)
#     db.session.commit()
#     cache.delete('/api/inventaire/geojson')  # Invalider le cache
#     return jsonify(serialize_inventaire(item))

# Lancement de l'application Flask en mode debug
if __name__ == "__main__":
    app.run(debug=True)
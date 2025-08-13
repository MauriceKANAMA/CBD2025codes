document.addEventListener("DOMContentLoaded", function () {
  // Ajout de la position de notre carte sur notre page (GetMap)
  const map = L.map('map', {
    editable: true,
    zoomControl: false // Désactivation des boutons zoom par défaut
  }).setView([-11.6645, 27.484], 15.4);

   // Ajout de l'echelle de zoom de la carte
  L.control.scale({
    position: 'bottomleft',
    metric: true,      // Affiche l’échelle en mètres/kilomètres
    maxWidth: 100     // Largeur max en pixels de l’échelle
  }).addTo(map);

  const positionInitiale = {
    coords: [-11.6645, 27.484],
    zoom: 15.4
  };


  // GESTION DE LA BARRE GAUCHE
  const toggleButton = document.querySelector('.toggle-sidebar');
  const sidebar = document.querySelector('.sidebar');

  // Cacher la sidebar au chargement
  sidebar.classList.add('hidden');

  // Gérer l'affichage lors du clic
  toggleButton.addEventListener('click', function () {
    sidebar.classList.toggle('hidden');
  });

  // Fond de carte OSM et ESRI
  const Carto_Light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM & Carto &copy;Copyright 2025',
    maxZoom: 22
  }).addTo(map);

  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', 
    {foo: 'bar', 
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy;Copyright 2025',
    maxZoom: 22
  });

  const Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri the GIS User Community &copy;Copyright 2025',
    maxZoom: 22
  });

  //AJOUT DE NOS COUCHES 
  //Chargement des données WFS GeoJSON pour l'inventaire et des WMS des autres couches
  //const Inventaire = "https://geoserver2.duckdns.org/geoserver/CDB_Lushi_2025/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=CDB_Lushi_2025%3AInventaire_complet&outputFormat=application%2Fjson&maxFeatures=2554";

  const limites = L.tileLayer.wms("https://geoserver2.duckdns.org/geoserver/CDB_Lushi_2025/wms", {
    layers: "CDB_Lushi_2025:Limites2025",
    format: "image/png",
    transparent: true,
    maxZoom: 22
  });

  const blocs = L.tileLayer.wms("https://geoserver2.duckdns.org/geoserver/CDB_Lushi_2025/wms", {
    layers: "CDB_Lushi_2025:BlocsCBD",
    format: "image/png",
    transparent: true,
    maxZoom: 22
  });

  const buildings = L.tileLayer.wms("https://geoserver2.duckdns.org/geoserver/CDB_Lushi_2025/wms", {
    layers: "CDB_Lushi_2025:BuildingsCBD",
    format: "image/png",
    transparent: true,
    maxZoom: 22
  });

  // --- Contrôle de calques ---
  const overlays = {
    "Bâtiments": buildings,
    "Blocs": blocs,
    "Limites": limites
  };

  L.control.layers(null, overlays, {
    title: 'Legende',
    collapsed: true,
    position: 'bottomright'
  }).addTo(map);

  let allFeatures = []; // Pour stocker toutes les entités initiales
  let markers = L.layerGroup(); // Cluster global
  let measureControl = null; // Pour le contrôle de mesure

  // Déclaration des éléments DOM utilisés dans les fonctions
  let sousCategorieSelect = document.getElementById("sousCategorie");

  // Ajout de la couche Inventaire sur base de notre methode GET API
  fetch("/api/inventaire/geojson")
    .then(response => response.json())
    .then(data => {
      allFeatures = data.features;

      mettreAJourSousCategories("Hôtels - Restaurants - Cafés");

      // Sélection automatique de la catégorie "Hôtels - Restaurants - Cafés"
      document.getElementById("categorie").value = "Hôtels - Restaurants - Cafés";
      afficherFeaturesFiltrées("Hôtels - Restaurants - Cafés"); // Affichage auto d'une catégorie pour reduire le temps de chargement

    })

    .catch(error => {
      console.error("Erreur lors du chargement de l'API Flask :", error);
    })

    // Fonction pour le filtrage des entités pour la selection par categorie et recherche par nom
    function afficherFeaturesFiltrées(categorieFiltre, termeRecherche = "", sousCategorieFiltre = "") {
      // Remove existing layers
      markers.clearLayers();
      
      // Remove existing glify layer if it exists
      if (window.currentGlLayer) {
        window.currentGlLayer.remove();
        window.currentGlLayer = null;
      }

      let dataFiltrée = allFeatures;

      // Filtrage par catégorie
      if (categorieFiltre && categorieFiltre !== "Choisissez une catégorie") {
        dataFiltrée = dataFiltrée.filter(f => f.properties.categories === categorieFiltre);
      }

      // Filtrage par sous-catégorie
      if (sousCategorieFiltre && sousCategorieFiltre !== "Choisissez une sous-catégorie") {
        dataFiltrée = dataFiltrée.filter(f => f.properties.sous_categ === sousCategorieFiltre);
      }

      // Filtrage par nom, avenue, rubriques et descriptions
      if (termeRecherche) {
        const terme = termeRecherche.toLowerCase();
        dataFiltrée = dataFiltrée.filter(f => {
          const props = f.properties;
          return (
            (props.nom_etabli && props.nom_etabli.toLowerCase().includes(terme)) ||
            (props.adresses && props.adresses.toLowerCase().includes(terme)) ||
            (props.description && props.description.toLowerCase().includes(terme)) ||
            (props.sous_categ && props.sous_categ.toLowerCase().includes(terme)) ||
            (props.types_rubr && props.types_rubr.toLowerCase().includes(terme))
          );
        });
      }

      // Convert data to glify format
      const glifyData = dataFiltrée.map(feature => {
        return [feature.geometry.coordinates[1], feature.geometry.coordinates[0]]; // lat, lng
      });

      // Create new glify layer if we have data to display
      if (glifyData.length > 0) {
        window.currentGlLayer = L.glify.points({
          data: glifyData,
          map: map,
          click: function (e, point, xy) {
            // Handle click events for displaying popups
            // Find the feature that corresponds to this point
            const lat = point[0];
            const lng = point[1];
            
            // Find the feature in dataFiltrée that matches this point
            const feature = dataFiltrée.find(f =>
              f.geometry.coordinates[1] === lat && f.geometry.coordinates[0] === lng
            );
            
            if (feature) {
              const props = feature.properties;
              const nom = props.nom_etabli || "Inconnu";
              const categorie = props.categories || "Non définie";
              const sousCategorie = props.sous_categ || "Non définie";
              const Rubrique = props.types_rubr || "Non définie";
              const description = props.descriptio || "Aucune description";
              const adresse = props.adresses || "Aucune adresse disponible";
              
              // Create popup content
              const popupContent = `
                <div class="custom-popup">
                  <h3><i class="fas fa-store"></i> ${nom}</h3>
                  <p><strong>Catégorie :</strong> ${categorie}</p>
                  <p><strong>Sous-catégorie :</strong> ${sousCategorie}</p>
                  <p><strong>Rubrique :</strong> ${Rubrique}</p>
                  <p><strong>Description :</strong> ${description}</p>
                  <p><strong>Adresse :</strong> Avenue ${adresse}</p>
                </div>
              `;
              
              // Create a popup at the clicked location
              L.popup()
                .setLatLng([lat, lng])
                .setContent(popupContent)
                .openOn(map);
            }
          },
          // Customize the appearance of points
          color: function(index, point) {
            // You can customize colors based on categories or other properties
            return {
              r: 0,
              g: 100,
              b: 200,
              a: 0.8
            };
          },
          size: 10 // Point size in pixels
        });
      }
    }

  //Recherche selon les noms d etablisement et avenues
  function mettreAJourListeResultats(termeRecherche, categorieFiltre) {
    const resultList = document.getElementById("searchResults");
    resultList.innerHTML = ""; // vide la liste

    let resultats = allFeatures;

    if (categorieFiltre && categorieFiltre !== "Choisissez une catégorie") {
      resultats = resultats.filter(f => f.properties.categories === categorieFiltre);
    }

    if (termeRecherche) {
      const terme = termeRecherche.toLowerCase();
      resultats = resultats.filter(f => {
        const props = f.properties;
        return (
          (props.nom_etabli && props.nom_etabli.toLowerCase().includes(terme)) ||
          (props.adresses && props.adresses.toLowerCase().includes(terme)) ||
          (props.description && props.description.toLowerCase().includes(terme)) ||
          (props.types_rubr && props.types_rubr.toLowerCase().includes(terme))
        );
      });
    }

    // Afficher les 10 premiers résultats max
    resultats.slice(0, 10).forEach(feature => {
      const li = document.createElement("li");
      li.textContent = `${feature.properties.nom_etabli || "Inconnu"} - ${feature.properties.adresses || "Inconnue"}`;
      li.addEventListener("click", () => {
        const coords = feature.geometry.coordinates;
        const latlng = L.latLng(coords[1], coords[0]);
        map.setView(latlng, 18); // zoom sur le point
        // Créer un marqueur temporaire (facultatif)
        L.popup()
          .setLatLng(latlng)
          .setContent(`<strong>${feature.properties.nom_etabli}</strong>`)
          .openOn(map);
      });
      resultList.appendChild(li);
    });

    // Si aucun résultat
    if (resultats.length === 0 && termeRecherche) {
      const li = document.createElement("li");
      li.textContent = "Aucun résultat trouvé.";
      li.style.fontStyle = "italic";
      li.style.color = "gray";
      resultList.appendChild(li);
    }
  }

  // Ajout de la selection a partir des sous categories de la categorie principale

  function mettreAJourSousCategories(categorie) {
    const sousCategories = new Set();

    // Extraire toutes les sous-catégories possibles de la catégorie sélectionnée
    allFeatures.forEach(feature => {
      if (
        (!categorie || feature.properties.categories === categorie) &&
        feature.properties.sous_categ
      ) {
        sousCategories.add(feature.properties.sous_categ.trim());
      }
    });

    // Nettoyer le menu existant
    sousCategorieSelect.innerHTML = `<option value="">Choisissez une sous-catégorie</option>`;

    // Ajouter chaque sous-catégorie comme option
    Array.from(sousCategories).sort().forEach(sc => {
      const option = document.createElement("option");
      option.value = sc;
      option.textContent = sc;
      sousCategorieSelect.appendChild(option);
    });
  }

  sousCategorieSelect.addEventListener("change", function () {
    const selectedCategorie = document.getElementById("categorie").value;
    const termeRecherche = document.getElementById("search").value;
    const sousCategorieFiltre = this.value;

    afficherFeaturesFiltrées(selectedCategorie, termeRecherche, sousCategorieFiltre);
  });


  // EVENEMENTS POUR LA RECHERCHE ET LE FILTRAGE
  // Utilisation du select HTML pour la recherche par catégorie
  document.getElementById("categorie").addEventListener("change", function () {
    const selectedCategorie = this.value;
    const termeRecherche = document.getElementById("search").value;

    // Mettre à jour la liste des sous-catégories
    mettreAJourSousCategories(selectedCategorie);

    const sousCategorieFiltre = sousCategorieSelect.value;
    afficherFeaturesFiltrées(selectedCategorie, termeRecherche, sousCategorieFiltre);
  });



  // Utilisation du boutton HTML pour la recherche
  document.getElementById("search").addEventListener("input", function () {
    const termeRecherche = this.value;
    const selectedCategorie = document.getElementById("categorie").value;
    afficherFeaturesFiltrées(selectedCategorie, termeRecherche);
    mettreAJourListeResultats(termeRecherche, selectedCategorie);
  });

  // Utilisation du bouton HTML pour réinitialiser les filtres
  document.getElementById("resetFilters").addEventListener("click", function () {
    // Réinitialise les champs
    document.getElementById("categorie").value = "";
    document.getElementById("search").value = "";
    document.getElementById("sousCategorie").value = "";

    // Recharge toutes les entités
    afficherFeaturesFiltrées("", "");

    document.getElementById("searchResults").innerHTML = "";

    // Recentrer à la position initiale
    map.setView(positionInitiale.coords, positionInitiale.zoom);

    // Mise a jour de la sous categorie
    mettreAJourSousCategories("");
  });

  // Basemap switching logic
  document.getElementById("baseLayerBtn").addEventListener("click", function () {
    document.getElementById("basemapMenu").classList.toggle("hidden");
  });

  document.getElementById("basemapMenu").addEventListener("click", function (e) {
    if (e.target.tagName === 'LI') {
      const selectedLayer = e.target.getAttribute("data-layer");

      // Supprimer tous les fonds de carte avant d'ajouter le bon
      map.removeLayer(osm);
      map.removeLayer(Esri_WorldImagery);
      map.removeLayer(Carto_Light);

      // Ajouter le fond sélectionné
      if (selectedLayer === "osm") {
        map.addLayer(osm);
      } else if (selectedLayer === "esri") {
        map.addLayer(Esri_WorldImagery);
      } else if (selectedLayer === "carto") {
        map.addLayer(Carto_Light);
      }

      // Masquer le menu après sélection
      document.getElementById("basemapMenu").classList.add("hidden");
    }
  });


  // SCRIPTS DE LA BARRE DE DROITE
  // Gérer les boutons zoom
  document.getElementById("zoomIn").addEventListener("click", function () {
    map.zoomIn();
  });

  document.getElementById("zoomOut").addEventListener("click", function () {
    map.zoomOut();
  });

  // Initialise le dessin (mais on l'active seulement au clic)
  const drawControl = new L.Draw.Rectangle(map, {
    shapeOptions: {
      color: '#f06eaa',
      weight: 2,
    }
  });

  document.getElementById('zoomSelectBtn').onclick = () => {
    drawControl.enable();
  };

  // Quand le rectangle est dessiné, zoom sur cette zone
  map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    const bounds = layer.getBounds();
    map.fitBounds(bounds);
    drawControl.disable();
  });

  // ZOOM ÉTENDU - Corrigé
  document.getElementById("zoomExtentBtn").addEventListener("click", function () {
    map.setView(positionInitiale.coords, positionInitiale.zoom);
  });

  let trackingId = null;
  let userMarker = null;
  let userCircle = null;
  let isTracking = false;

  const locateBtn = document.getElementById("locateBtn");

  locateBtn.addEventListener("click", () => {
    if (!isTracking) {
      // ▶️ ACTIVER LE SUIVI
      trackingId = navigator.geolocation.watchPosition(
        position => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const latlng = L.latLng(lat, lng);

          // Supprimer anciens éléments
          if (userMarker) map.removeLayer(userMarker);
          if (userCircle) map.removeLayer(userCircle);

          // 📍 Marqueur utilisateur
          userMarker = L.marker(latlng, {
            icon: L.icon({
              iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
              iconSize: [30, 30],
              iconAnchor: [15, 30]
            })
          }).addTo(map).bindPopup("📍 Vous êtes ici");

          // 🔵 Cercle de précision
          userCircle = L.circle(latlng, {
            radius: accuracy,
            color: "blue",
            fillColor: "blue",
            fillOpacity: 0.1
          }).addTo(map);

          // Centrage sans zoom
          map.panTo(latlng);
        },
        error => {
          alert("❌ Erreur de géolocalisation : " + error.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );

      isTracking = true;

      // 🔄 Changer le style du bouton
      locateBtn.classList.remove("btn-inactive");
      locateBtn.classList.add("btn-active");
      locateBtn.textContent = "🛰️";
    } else {
      // ⛔ DÉSACTIVER LE SUIVI
      navigator.geolocation.clearWatch(trackingId);
      trackingId = null;
      isTracking = false;

      // Supprimer marqueur et cercle
      if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
      }
      if (userCircle) {
        map.removeLayer(userCircle);
        userCircle = null;
      }

      // 🔁 Changer l’apparence du bouton
      locateBtn.classList.remove("btn-active");
      locateBtn.classList.add("btn-inactive");
      locateBtn.textContent = "📡";
    }
  });

  document.getElementById("measureDistanceBtn").addEventListener("click", function() {
    if (!measureControl) {
      measureControl = new L.Draw.Polyline(map, {
        shapeOptions: {
          color: 'red',
          weight: 4
        }
      });
    }
    measureControl.enable();
  });

  const measureModal = document.getElementById("measureModal");
  const distanceTextEl = document.getElementById("distanceText");
  const deleteMeasureBtn = document.getElementById("deleteMeasureBtn");
  const closeMeasureBtn = document.getElementById("closeMeasureBtn");

  let currentMeasureLayer = null;

  map.on(L.Draw.Event.CREATED, function (e) {
    if (e.layerType === 'polyline') {
      if (currentMeasureLayer) {
        map.removeLayer(currentMeasureLayer);  // Supprime ancienne mesure si existante
      }

      currentMeasureLayer = e.layer;
      map.addLayer(currentMeasureLayer);

      const latlngs = currentMeasureLayer.getLatLngs();
      let totalDistance = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        totalDistance += latlngs[i].distanceTo(latlngs[i + 1]);
      }

      const distanceText = totalDistance >= 1000
        ? (totalDistance / 1000).toFixed(2) + " km"
        : Math.round(totalDistance) + " m";

      distanceTextEl.textContent = `Distance : ${distanceText}`;

      // Affiche la modale
      measureModal.classList.remove("hidden");
    }
  });

  deleteMeasureBtn.onclick = function () {
    if (currentMeasureLayer) {
      map.removeLayer(currentMeasureLayer);
      currentMeasureLayer = null;
    }
    measureModal.classList.add("hidden");
  };

  closeMeasureBtn.onclick = function () {
    measureModal.classList.add("hidden");
  };

  document.querySelector('.Contact').addEventListener('click', function () {
    document.getElementById('contactModal').classList.remove('hidden');
  });

  // Fermer la modal
  document.getElementById('closeModal').addEventListener('click', function () {
    document.getElementById('contactModal').classList.add('hidden');
  });

  // WhatsApp
  document.getElementById('whatsappBtn').addEventListener('click', function () {
    const numero = "+243972860597";
    const message = encodeURIComponent("Bonjour, je vous contacte au sujet de votre application web SIG du centre des affaires de Lubumbashi.");
    const whatsappURL = `https://wa.me/${numero}?text=${message}`;
    window.open(whatsappURL, "_blank");
    document.getElementById('contactModal').classList.add('hidden');
  });

  // Email
  document.getElementById('emailBtn').addEventListener('click', function () {
    const email = 'mauricekanama1@email.com';
    const subject = encodeURIComponent('Demande de contact');
    const body = encodeURIComponent('Bonjour,\n\nJe souhaite entrer en contact avec vous concernant votre application web SIG du centre des affaires de Lubumbashi.');
    const mailtoUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
    document.getElementById('contactModal').classList.add('hidden');
  });

});
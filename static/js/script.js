document.addEventListener("DOMContentLoaded", function () {
  const map = L.map('map', {
    editable: true,
    zoomControl: false
  }).setView([-11.6645, 27.484], 15.4);

  L.control.scale({ position: 'bottomleft', metric: true, maxWidth: 100 }).addTo(map);

  const positionInitiale = { coords: [-11.6645, 27.484], zoom: 15.4 };
  const toggleButton = document.querySelector('.toggle-sidebar');
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.add('hidden');
  toggleButton.addEventListener('click', () => sidebar.classList.toggle('hidden'));

  const Carto_Light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM & Carto 2025', maxZoom: 22
  }).addTo(map);
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', {
    foo: 'bar', attribution: '&copy; OpenStreetMap 2025', maxZoom: 22
  });
  const Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri 2025', maxZoom: 22
  });


  // LES AUTRES COUCHES


  let couchesGroup = L.layerGroup().addTo(map);

  // Légende (au départ affichée)
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    div.style.backgroundColor = "white";
    div.style.padding = "8px";
    div.style.fontSize = "14px";
    div.style.lineHeight = "18px";
    div.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)";
    div.innerHTML = `
      <strong>Légende</strong><br>
      <span style="display:inline-block;width:20px;height:0;
            border-top:3px solid green;
            margin-right:4px;vertical-align:middle;"></span> Limites du C.B.D<br>

      
    `;
    // <span style="display:inline-block;width:20px;height:5px;
    //         border-radius: 15px;
    //         border:2px solid;
    //         margin-right:4px;vertical-align:middle;"></span> Blocs du C.B.D<br>

    // <span style="display:inline-block;width:20px;height:5px;
      //       border-radius: 15px;
      //       border:2px solid;
      //       margin-right:4px;vertical-align:middle;"></span> Bâtiments du C.B.D<br>

    return div;
  };

  // Fonction pour charger les couches
  function loadCouches() {
    // fetch("/api/geojson/BuildingsCBD")
    //   .then(res => res.json())
    //   .then(data => {
    //     L.geoJSON(data, { style: { color: "red" } }).addTo(couchesGroup);
    //   });

    // fetch("/api/geojson/BlocsCBD")
    //   .then(res => res.json())
    //   .then(data => {
    //     L.geoJSON(data, { style: { color: "black", weight: 2, fillColor: "blue", fillOpacity: 0 } }).addTo(couchesGroup);
    //   });

    fetch("/api/geojson/Limites2025")
      .then(res => res.json())
      .then(data => {
        L.geoJSON(data, { style: { color: "green", weight: 3, fillColor: "green", fillOpacity: 0 }, interactive: false  }).addTo(couchesGroup);
      });
  }

  loadCouches();

  // Bouton toggle couches + légende
  const toggleControl = L.control({ position: "bottomright" });
  toggleControl.onAdd = function () {
    const div = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
    div.style.backgroundColor = "white";
    div.style.padding = "5px";
    div.style.cursor = "pointer";
    div.style.fontSize = "13px";
    div.innerHTML = "🗺️ Légende";

    let visible = false;

    div.onclick = function () {
      if (visible) {
        map.removeLayer(couchesGroup);
        map.removeControl(legend);
        visible = false;
      } else {
        map.addLayer(couchesGroup);
        legend.addTo(map);
        visible = true;
      }
    };

    return div;
  };
  toggleControl.addTo(map);





  // FIN DES AUTRES COUCHES


  // AJOUT DES COUCHES VECTORIELLES





  let deckLayer = null;
  let allFeatures = [];
  let sousCategorieSelect = document.getElementById("sousCategorie");

  // Spinner dynamique dans le DOM
  (function createSpinner() {
    const spinner = document.createElement("div");
    spinner.id = "spinner";
    spinner.style.position = "fixed";
    spinner.style.top = "0";
    spinner.style.left = "0";
    spinner.style.width = "100%";
    spinner.style.height = "100%";
    spinner.style.background = "rgba(255,255,255,0)";
    spinner.style.display = "flex";
    spinner.style.justifyContent = "center";
    spinner.style.alignItems = "center";
    spinner.style.zIndex = "9999";
    spinner.innerHTML = `<div class="loader"></div>`;
    document.body.appendChild(spinner);

    const style = document.createElement("style");
    style.innerHTML = `
      .loader {
        border: 8px solid #f3f3f3;
        border-top: 8px solid #3498db;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  })();

  function showSpinner() {
    document.getElementById("spinner").style.display = "flex";
  }
  function hideSpinner() {
    document.getElementById("spinner").style.display = "none";
  }

  // Construction des données deck.gl avec couleurs par catégorie
  function makeDeckData(features) {
    const colorMap = {
      "Alimentation": [52, 152, 219],
      "Equipements": [46, 204, 113],
      "Habillement": [241, 196, 50],
      "Hôtels - Restaurants - Cafés": [231, 76, 60],
      "Loisirs - Luxe - Culture": [155, 89, 182],
      "Services": [21, 10, 15]
    };

    return features.map(f => {
      const coords = f.geometry.coordinates;
      const cat = f.properties.categories;
      const color = colorMap[cat] || [127, 140, 141]; // gris par défaut
      return {
        position: [coords[0], coords[1]],
        color,
        properties: f.properties
      };
    });
  }

  // Création de la couche deck.gl
  function updateDeckLayer(data) {
    if (deckLayer) {
      map.removeLayer(deckLayer);
      deckLayer = null;
    }
    const deckData = makeDeckData(data);
    const iconLayer = new deck.IconLayer({
      id: 'deckgl-icon-markers',
      data: deckData,
      pickable: true,
      getPosition: d => d.position,
      getIcon: d => ({
        url: 'https://cdn-icons-png.flaticon.com/512/252/252025.png',
        width: 128,
        height: 128,
        anchorY: 128  // l’icône pointe vers le bas
      }),
      getSize: 32,          // taille logique
      sizeScale: 1,         // échelle globale
      onClick: info => {
        const object = info.object;
        if (!object || !object.position || !map) {
          console.warn("Pas de données suffisantes pour afficher le popup");
          return;
        }

        const { position, properties } = object;

        const popupContent = `
          <div class="custom-popup">
            <h3><i class="fas fa-store"></i> ${properties.nom_etabli || "Inconnu"}</h3>
            <p><strong>Catégorie :</strong> ${properties.categories || "Non définie"}</p>
            <p><strong>Sous-catégorie :</strong> ${properties.sous_categ || "Non définie"}</p>
            <p><strong>Rubrique :</strong> ${properties.types_rubr || "Non définie"}</p>
            <p><strong>Description :</strong> ${properties.description || "Aucune description"}</p>
            <p><strong>Adresse :</strong> Avenue ${properties.adresses || "Aucune adresse disponible"}</p>
          </div>
        `;

        L.popup()
          .setLatLng([position[1], position[0]]) // Leaflet = [lat, lng]
          .setContent(popupContent)
          .openOn(map);
      }
    });

    deckLayer = new DeckGlLeaflet.LeafletLayer({ layers: [iconLayer] });
    map.addLayer(deckLayer);
  }

  const iconLayer = new deck.IconLayer({
    id: 'scatter-test',
    data: [
      { position: [2.35, 48.85], color: [255, 0, 0], properties: { nom: "Test" } }
    ],
    pickable: true,
    getPosition: d => d.position,
    getFillColor: d => d.color,
    getRadius: 30,
    onClick: info => {
      console.log("CLICK SUR TEST POINT", info);
    }
  });

  deckLayer = new DeckGlLeaflet.LeafletLayer({ layers: [iconLayer] });
  map.addLayer(deckLayer);

  // Chargement initial
  showSpinner();
  fetch("/api/inventaire/geojson")
    .then(response => response.json())
    .then(data => {
      allFeatures = data.features;
      mettreAJourSousCategories("Hôtels - Restaurants - Cafés");
      document.getElementById("categorie").value = "Hôtels - Restaurants - Cafés";
      afficherFeaturesFiltrées("Hôtels - Restaurants - Cafés");
      hideSpinner();
    })
    .catch(error => {
      console.error("Erreur API:", error);
      hideSpinner();
    });

  // Filtrage + affichage
  function afficherFeaturesFiltrées(categorie, terme = "", sousCategorie = "") {
    showSpinner();
    let filtered = allFeatures;

    if (categorie && categorie !== "Choisissez une catégorie")
      filtered = filtered.filter(f => f.properties.categories === categorie);
    if (sousCategorie && sousCategorie !== "Choisissez une sous-catégorie")
      filtered = filtered.filter(f => f.properties.sous_categ === sousCategorie);
    if (terme) {
      const t = terme.toLowerCase();
      filtered = filtered.filter(f => {
        const p = f.properties;
        return (p.nom_etabli?.toLowerCase().includes(t) ||
                p.adresses?.toLowerCase().includes(t) ||
                p.description?.toLowerCase().includes(t) ||
                p.types_rubr?.toLowerCase().includes(t));
      });
    }

    updateDeckLayer(filtered);
    hideSpinner();
  }

  // Liste des résultats sous la barre de recherche
  function mettreAJourListeResultats(terme, categorie) {
    const resultList = document.getElementById("searchResults");
    resultList.innerHTML = "";

    let results = allFeatures;
    if (categorie && categorie !== "Choisissez une catégorie")
      results = results.filter(f => f.properties.categories === categorie);
    if (terme) {
      const t = terme.toLowerCase();
      results = results.filter(f => {
        const p = f.properties;
        return (p.nom_etabli?.toLowerCase().includes(t) ||
                p.adresses?.toLowerCase().includes(t) ||
                p.description?.toLowerCase().includes(t) ||
                p.types_rubr?.toLowerCase().includes(t));
      });
    }

    results.slice(0, 10).forEach(feature => {
      const li = document.createElement("li");
      li.textContent = `${feature.properties.nom_etabli || "Inconnu"} - ${feature.properties.adresses || "Inconnue"}`;
      li.addEventListener("click", () => {
        const coords = feature.geometry.coordinates;
        map.setView([coords[1], coords[0]], 18);
        L.popup()
          .setLatLng([coords[1], coords[0]])
          .setContent(`<strong>${feature.properties.nom_etabli}</strong>`)
          .openOn(map);
      });
      resultList.appendChild(li);
    });

    if (results.length === 0 && terme) {
      const li = document.createElement("li");
      li.textContent = "Aucun résultat trouvé.";
      li.style.fontStyle = "italic";
      li.style.color = "gray";
      resultList.appendChild(li);
    }
  }

  // Mise à jour des sous-catégories dynamiquement
  function mettreAJourSousCategories(categorie) {
    const sousCategories = new Set();
    allFeatures.forEach(f => {
      if ((!categorie || f.properties.categories === categorie) && f.properties.sous_categ) {
        sousCategories.add(f.properties.sous_categ.trim());
      }
    });

    sousCategorieSelect.innerHTML = `<option value="">Choisissez une sous-catégorie</option>`;
    Array.from(sousCategories).sort().forEach(sc => {
      const option = document.createElement("option");
      option.value = sc;
      option.textContent = sc;
      sousCategorieSelect.appendChild(option);
    });
  }

  // Listeners
  sousCategorieSelect.addEventListener("change", () => {
    const cat = document.getElementById("categorie").value;
    const search = document.getElementById("search").value;
    afficherFeaturesFiltrées(cat, search, sousCategorieSelect.value);
  });

  document.getElementById("categorie").addEventListener("change", function () {
    const cat = this.value;
    const search = document.getElementById("search").value;
    mettreAJourSousCategories(cat);
    afficherFeaturesFiltrées(cat, search, sousCategorieSelect.value);
  });

  document.getElementById("search").addEventListener("input", function () {
    const search = this.value;
    const cat = document.getElementById("categorie").value;
    afficherFeaturesFiltrées(cat, search);
    mettreAJourListeResultats(search, cat);
  });

  document.getElementById("resetFilters").addEventListener("click", function () {
    document.getElementById("categorie").value = "";
    document.getElementById("search").value = "";
    sousCategorieSelect.value = "";
    afficherFeaturesFiltrées("", "");
    document.getElementById("searchResults").innerHTML = "";
    mettreAJourSousCategories("");
    map.setView(positionInitiale.coords, positionInitiale.zoom);
  });

  document.querySelector("canvas").addEventListener("click", () => {
    console.log("Canvas cliqué !");
  });








  // FIN D AJOUT DES DONNEES
  


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

  // Mesure de distance
  

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
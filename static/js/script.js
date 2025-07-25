document.addEventListener("DOMContentLoaded", function () {
  // Ajout de la position de notre carte sur notre page (GetMap)
  const map = L.map('map', {
      editable: true,
      zoomControl: false // Désactive les boutons par défaut
  }).setView([-11.6645, 27.484], 15.4);

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
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', 
      {foo: 'bar', 
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  // Sélection du fond de carte
  basemapMenu.addEventListener("click", function () {
    if (selectedLayer === "osm") {
      map.removeLayer(Esri_WorldImagery);
      map.addLayer(osm);
    } else if (selectedLayer === "esri") {
      map.removeLayer(osm);
      map.addLayer(Esri_WorldImagery);
    }
  });

  //AJOUT DE NOS COUCHES 
  //Chargement des données WFS GeoJSON pour l'inventaire
  const Inventaire = "https://geoservercarto.duckdns.org/geoserver/CDB_Lushi_2025/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=CDB_Lushi_2025%3AInventaire_complet&outputFormat=application%2Fjson&maxFeatures=2554";
  
  // Affichage du spinner lors du chargement des données
  function showSpinner() {
    document.getElementById("spinner").classList.remove("hidden");
  }

  function hideSpinner() {
    document.getElementById("spinner").classList.add("hidden");
  }

  let allFeatures = []; // Pour stocker toutes les entités initiales
  let markers = L.layerGroup(); // Cluster global

  showSpinner(); // Spinner ON

  fetch(Inventaire)
    .then(response => response.json())
    .then(data => {
      allFeatures = data.features;
      // Sélection automatique de la catégorie "Alimentation"
      document.getElementById("categorie").value = "Alimentation";
      afficherFeaturesFiltrées("Alimentation"); // Affichage auto de cette catégorie pour reduire le temps de chargement

    })

    .catch(error => {
      console.error("Erreur lors du chargement WFS GeoJSON :", error);
    })
    .finally(() => {
      hideSpinner(); // Toujours arrêter le spinner à la fin
    });


  // Fonction pour le filtrage des entités pour la selection par categorie et recherche par nom
  function afficherFeaturesFiltrées(categorieFiltre, termeRecherche = "") {
    showSpinner(); // Debut du chargement
    markers.clearLayers();

    let dataFiltrée = allFeatures;

    // Filtrage par catégorie
    if (categorieFiltre && categorieFiltre !== "-- Choisir une catégorie --") {
      dataFiltrée = dataFiltrée.filter(f => f.properties.categories === categorieFiltre);
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
          (props.types_rubr && props.types_rubr.toLowerCase().includes(terme)) ||
          (props.categories && props.categories.toLowerCase().includes(terme))
        );
      });
    }

    const coucheGeoJSON = L.geoJSON(dataFiltrée, {
      onEachFeature: function (feature, layer) {
        if (feature.properties) {
          const nom = feature.properties.nom_etabli || "Inconnu";
          const categorie = feature.properties.categories || "Non définie";
          const sousCategorie = feature.properties.sous_categ || "Non définie";
          const Rubrique = feature.properties.types_rubr || "Non définie";
          const description = feature.properties.descriptio || "Aucune description disponible";
          const adresse = feature.properties.adresses || "Aucune adresse disponible";

          layer.bindPopup(
            `<div class="custom-popup">
                <h3><i class="fas fa-store"></i> ${nom}</h3>
                <p><strong>Catégorie :</strong> ${categorie}</p>
                <p><strong>Sous-catégorie :</strong> ${sousCategorie}</p>
                <p><strong>Rubrique :</strong> ${Rubrique}</p>
                <p><strong>Description :</strong> ${description}</p>
                <p><strong>Adresse :</strong> Avenue ${adresse}</p>
            </div>`
          );


          layer.on("click", function () {
            const popup = L.popup()
          });
        }
      },
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng, {
          icon: L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            shadowSize: [41, 41]
          })
        });
      }
    });

    markers.addLayer(coucheGeoJSON);
    map.addLayer(markers);

    markers.addLayer(coucheGeoJSON);
    map.addLayer(markers);

    hideSpinner(); // Fin du chargement
  }

  function mettreAJourListeResultats(termeRecherche, categorieFiltre) {
    const resultList = document.getElementById("searchResults");
    resultList.innerHTML = ""; // vide la liste

    let resultats = allFeatures;

    if (categorieFiltre && categorieFiltre !== "-- Choisir une catégorie --") {
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
          (props.sous_categ && props.sous_categ.toLowerCase().includes(terme)) ||
          (props.types_rubr && props.types_rubr.toLowerCase().includes(terme)) ||
          (props.categories && props.categories.toLowerCase().includes(terme))
        );
      });
    }

    // Afficher les 10 premiers résultats max
    resultats.slice(0, 10).forEach(feature => {
      const li = document.createElement("li");
      li.textContent = feature.properties.nom_etabli || "Inconnu";
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

  // EVENEMENTS POUR LA RECHERCHE ET LE FILTRAGE
  // Utilisation du select HTML pour la recherche par catégorie
  document.getElementById("categorie").addEventListener("change", function () {
    const selectedCategorie = this.value;
    const termeRecherche = document.getElementById("search").value;
    afficherFeaturesFiltrées(selectedCategorie, termeRecherche);
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

    // Recharge toutes les entités
    afficherFeaturesFiltrées("", "");

    document.getElementById("searchResults").innerHTML = "";

    // Recentrer à la position initiale
    map.setView(positionInitiale.coords, positionInitiale.zoom);
  });

  // Basemap switching logic
  document.getElementById("baseLayerBtn").addEventListener("click", function () {
    document.getElementById("basemapMenu").classList.toggle("hidden");
  });

  document.getElementById("basemapMenu").addEventListener("click", function (e) {
    if (e.target.tagName === 'LI') {
      const selectedLayer = e.target.getAttribute("data-layer");

      if (selectedLayer === "osm") {
        map.removeLayer(Esri_WorldImagery);
        map.addLayer(osm);
      } else if (selectedLayer === "esri") {
        map.removeLayer(osm);
        map.addLayer(Esri_WorldImagery);
      }

      document.getElementById("basemapMenu").classList.add("hidden");
    }
  });

  // Fermer si on clique ailleurs
  document.addEventListener("click", function (e) {
    if (!baseLayerBtn.contains(e.target) && !basemapMenu.contains(e.target)) {
      basemapMenu.classList.add("hidden");
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



  document.querySelector('.Contact').addEventListener('click', function () {
    // Remplace par ton adresse email
    const email = 'mauricekanama1@email.com';
    const subject = encodeURIComponent('Demande de contact');
    const body = encodeURIComponent('Bonjour,\n\nJe souhaite entrer en contact avec vous concernant votre application web SIG du centre des affaires de Lubumbashi.');

      // Crée une URL mailto
      const mailtoUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;

      // Ouvre Gmail dans un nouvel onglet
      window.open(mailtoUrl, '_blank');
  });


});

document.addEventListener("DOMContentLoaded", function () {
  // Ajout de la position de notre carte sur notre page (GetMap)
  const map = L.map('map', {
      editable: true,
      zoomControl: false // Désactive les boutons par défaut
  }).setView([-11.6634, 27.485], 15.4);

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
  const Inventaire = "http://localhost:8080/geoserver/CBD_2025/ows?" +
    "service=WFS&version=1.0.0&request=GetFeature" +
    "&typeName=CBD_2025:Inventaire" +
    "&maxFeatures=2554&outputFormat=application/json";

  // Affichage du spinner lors du chargement des données
  function showSpinner() {
    document.getElementById("spinner").classList.remove("hidden");
  }

  function hideSpinner() {
    document.getElementById("spinner").classList.add("hidden");
  }


  // Appel de la donnee par API Rest GET declarer dans le code flask python
  // const Inventaire = "/api/inventaire/geojson";

  let allFeatures = []; // Pour stocker toutes les entités initiales
  let markers = L.layerGroup(); // Cluster global

  showSpinner(); // Spinner ON

  fetch(Inventaire)
    .then(response => response.json())
    .then(data => {
      allFeatures = data.features;
      afficherFeaturesFiltrées(""); // Rendu des entités
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
          (props["sous-categorie"] && props["sous-categorie"].toLowerCase().includes(terme)) ||
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
          const sousCategorie = feature.properties["sous-categorie"] || "Non définie";
          const Rubrique = feature.properties.types_rubr || "Non définie";
          const description = feature.properties.descriptio || "Aucune description disponible";
          const adresse = feature.properties.adresses || "Aucune adresse disponible";

          layer.bindPopup(
            `<strong>Nom</strong> : ${nom}` +
            `<br><strong>Catégorie</strong> : ${categorie}` +
            `<br><strong>Sous-catégorie</strong> : ${sousCategorie}` +
            `<br><strong>Rubrique</strong> : ${Rubrique}` +
            `<br><strong>Description</strong> : ${description}` +
            `<br><strong>Adresse</strong> : Avenue ${adresse}`
          );

          layer.on("click", function () {
            if (!modificationActive) return; // Si on n’est pas en mode édition, on ignore le clic

            const props = feature.properties;
            const id = props.id;
            const latlng = layer.getLatLng();

            const formHtml = `
              <form id="editForm">
                <label>Nom :</label><br>
                <input type="text" id="editNom" value="${props.nom_etabli || ''}"><br>

                <label>Catégorie :</label><br>
                <input type="text" id="editCategorie" value="${props.categories || ''}"><br>

                <label>Sous-catégorie :</label><br>
                <input type="text" id="editSousCateg" value="${props['sous-categorie'] || ''}"><br>

                <label>Rubriques :</label><br>
                <input type="text" id="editRubr" value="${props.types_rubr || ''}"><br>

                <label>Description :</label><br>
                <textarea id="editDesc">${props.description || ''}</textarea><br>

                <label>Avenue :</label><br>
                <input type="text" id="editAdresse" value="${props.adresses || ''}"><br>

                <label>Date :</label><br>
                <input type="date" id="editDate" value="${props.time || ''}"><br>

                <button type="submit">✅ Modifier</button>
              </form>
            `;

            const popup = L.popup()
              .setLatLng(latlng)
              .setContent(formHtml)
              .openOn(map);

            setTimeout(() => {
              document.getElementById("editForm").addEventListener("submit", function (event) {
                event.preventDefault();

                const updatedPoint = {
                  geom: { lat: latlng.lat, lng: latlng.lng },
                  NomEtabliss: document.getElementById("editNom").value,
                  Categorie: document.getElementById("editCategorie").value,
                  Sous_categorie: document.getElementById("editSousCateg").value,
                  Rubriques: document.getElementById("editRubr").value,
                  Description: document.getElementById("editDesc").value,
                  Avenue: document.getElementById("editAdresse").value,
                  Date: document.getElementById("editDate").value,
                };

                fetch(`/api/inventaire/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updatedPoint)
                })
                .then(res => res.json())
                .then(data => {
                  alert("✅ Point modifié avec succès !");
                  modificationActive = false;
                  map.closePopup();
                  location.reload();
                })
                .catch(err => {
                  console.error("Erreur :", err);
                  alert("❌ Erreur lors de la modification.");
                });
              });
            }, 100);
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
          (props["sous-categorie"] && props["sous-categorie"].toLowerCase().includes(terme)) ||
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

    // Appliquer un zoom étendu sur tous les points affichés
    setTimeout(() => {
      let bounds2;
      markers.eachLayer(layer => {
        if (!bounds2) {
          bounds2 = layer.getBounds ? layer.getBounds() : L.latLngBounds(layer.getLatLng());
        } else {
          bounds2.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
        }
      });
      if (bounds2 && bounds2.isValid()) {
        map.fitBounds(bounds2, { padding: [30, 30] });
      } else {
        alert("❌ Aucun point affiché pour effectuer un zoom étendu.");
      }
    }, 300); // délai pour attendre le rendu
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


  // SCRIPTS POUR API REST 
  // Ajout d'un point grace a l'API Rest Post
  document.getElementById("addPointBtn").addEventListener("click", function () {
    // Affiche la modale
    document.getElementById("modalAddPoint").classList.remove("hidden");

    // Gère le clic sur "Fermer"
    document.getElementById("closeAddPointModalBtn").addEventListener("click", function () {
      document.getElementById("modalAddPoint").classList.add("hidden");
    });

    map.once("click", function (e) {
      const latlng = e.latlng;

      const formHtml = `
        <form id="addForm">
          <label>Nom :</label><br>
          <input type="text" id="nom" required><br>

          <label>Catégorie :</label><br>
          <input type="text" id="categorie_form"><br>

          <label>Sous-catégorie :</label><br>
          <input type="text" id="sous-categ"><br>

          <label>Rubriques :</label><br>
          <input type="text" id="types_rubr"><br>

          <label>Description :</label><br>
          <textarea id="descriptio"></textarea><br>

          <label>Adresse (Avenue) :</label><br>
          <input type="text" id="adresses"><br>

          <label>Date :</label><br>
          <input type="date" id="time" required><br>

          <button type="submit">✅ Valider</button>
        </form>
      `;


      const popup = L.popup()
        .setLatLng(latlng)
        .setContent(formHtml)
        .openOn(map);

      setTimeout(() => {
        const form = document.getElementById("addForm");
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          
          const newPoint = {
            geom: { lat: latlng.lat, lng: latlng.lng },
            NomEtabliss: document.getElementById("nom").value,
            Categorie: document.getElementById("categorie").value,
            Sous_categorie: document.getElementById("sous-categ").value,
            Rubriques: document.getElementById("types_rubr").value,
            Description: document.getElementById("descriptio").value,
            Avenue: document.getElementById("adresses").value,
            Date: document.getElementById("time").value,
          };

          fetch("/api/inventaire", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newPoint)
          })
          .then(res => res.json())
          .then(data => {
            alert("✅ Point ajouté avec succès !");
            map.closePopup();
            location.reload();
          })
          .catch(err => {
            console.error("Erreur :", err);
            alert("❌ Erreur lors de l'ajout.");
          });
        });
      }, 100); // attend que le DOM du popup soit chargé
    });
  });


  let modificationActive = false;

  // Ajout d'un point grace a l'API Rest Put
  document.getElementById("editPointBtn").addEventListener("click", function () {
    modificationActive = true; // Active le mode modification
    // Affiche la modale
    document.getElementById("modalMessage").classList.remove("hidden");

    // Ferme la modale si on clique sur "fermer"
    document.getElementById("closeModalBtn").addEventListener("click", function () {
      document.getElementById("modalMessage").classList.add("hidden");
      modificationActive = false; // Désactive le mode modification
    });

    // Ensuite, active le clic sur les points
    map.eachLayer(layer => {
      if (layer.feature && layer.feature.properties.id) {
        layer.on("click", function () {
          const props = layer.feature.properties;
          const id = props.id;

          const nouveauNom = prompt("Nouveau nom ?", props.nom_etabli);
          if (!nouveauNom) return;

          const latlng = layer.getLatLng();

          const updatedPoint = {
            geom: { lat: latlng.lat, lng: latlng.lng },
            NomEtabliss: nouveauNom,
            Sous_categorie: nouveauNom,
            Rubriques: nouveauNom,
            Description: nouveauNom,
            Avenue: nouveauNom,
            Date: nouveauNom,
          };

          fetch(`/api/inventaire/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedPoint)
          })
          .then(res => res.json())
          .then(data => {
            alert("Point mis à jour !");
            location.reload();
          })
          .catch(err => {
            console.error("Erreur :", err);
            alert("Erreur lors de la modification.");
          });
        });
      }
    });
  });

  // ZOOM ÉTENDU - Corrigé
  document.getElementById("zoomExtentBtn").addEventListener("click", function () {
    let bounds;

    markers.eachLayer(layer => {
      if (!bounds) {
        bounds = layer.getBounds ? layer.getBounds() : L.latLngBounds(layer.getLatLng());
      } else {
        bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
      }
    });

    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] });
    } else {
      alert("❌ Aucun point affiché pour effectuer un zoom étendu.");
    }
  });

  // Crée une seule instance de mesure
  const mesureControl1 = L.control.polylineMeasure({
    position: 'topright',
    unit: 'metres',
    showBearings: false,
    clearMeasurementsOnStop: false,
    showClearControl: false,
    showUnitControl: false
  });

  let mesureActive = false;

  // Ouvrir/fermer le menu mesure
  const measureBtn = document.getElementById("measureBtn");
  const measureMenu = document.getElementById("measureMenu");

  measureBtn.addEventListener("click", () => {
    measureMenu.classList.toggle("hidden");
  });

  // Démarrer la mesure
  document.getElementById("startMeasure").addEventListener("click", () => {
    if (!mesureActive) {
      map.addControl(mesureControl1);
      mesureControl1._toggleMeasure();
      mesureActive = true;
    }
  });

  // Réinitialiser
  document.getElementById("clearMeasure").addEventListener("click", () => {
    if (mesureActive && mesureControl1._measuring) {
      mesureControl1._toggleMeasure(); // Arrêter
      mesureControl1._toggleMeasure(); // Redémarrer
    }
  });

  // Fermer le menu
  document.getElementById("closeMeasure").addEventListener("click", () => {
    measureMenu.classList.add("hidden");
    if (mesureActive && map.hasLayer(mesureControl1)) {
      mesureControl1._toggleMeasure(); // stop
      map.removeControl(mesureControl1);
      mesureActive = false;
    }
  });

  // Fermer si on clique ailleurs
  document.addEventListener("click", function (e) {
    if (!measureBtn.contains(e.target) && !measureMenu.contains(e.target)) {
      measureMenu.classList.add("hidden");
    }
  });

  // Suivi de ma position en temps reel
  let trackingId = null;
  let userMarker = null;
  let userCircle = null;
  let isTracking = false;

  document.getElementById("locateBtn").addEventListener("click", () => {
    if (!isTracking) {
      // DÉMARRER le suivi en temps réel
      trackingId = navigator.geolocation.watchPosition(
        position => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const latlng = L.latLng(lat, lng);

          // Supprimer anciens marqueurs/cercle
          if (userMarker) map.removeLayer(userMarker);
          if (userCircle) map.removeLayer(userCircle);

          // Marqueur de position
          userMarker = L.marker(latlng, {
            icon: L.icon({
              iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
              iconSize: [30, 30],
              iconAnchor: [15, 30]
            })
          }).addTo(map).bindPopup("📍 Vous êtes ici").openPopup();

          // Cercle de précision
          userCircle = L.circle(latlng, {
            radius: accuracy,
            color: "blue",
            fillColor: "blue",
            fillOpacity: 0.1
          }).addTo(map);

          // Centrer avec zoom arrière léger
          map.setView(latlng, map.getZoom() - 1);
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
      alert("📡 Suivi en temps réel activé. Si vous voulez le désactiver, cliquez à nouveau sur le bouton");
    } else {
      // ARRÊTER le suivi
      navigator.geolocation.clearWatch(trackingId);
      trackingId = null;
      isTracking = false;

      if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
      }

      if (userCircle) {
        map.removeLayer(userCircle);
        userCircle = null;
      }

      alert("🛑 Suivi désactivé");
    }
  });



});
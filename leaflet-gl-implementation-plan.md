# Leaflet.gl Implementation Plan

## Overview
This document outlines the plan to integrate leaflet.glify into the existing application to improve the performance of rendering 1000-5000 points on the map.

## Current Performance Issues
1. **Inefficient Marker Rendering**: The current implementation uses `L.geoJSON` with `pointToLayer` to create individual markers for each point. This approach creates a separate DOM element for each marker, which becomes inefficient with 1000-5000 points.

2. **Complete Layer Recreation**: Every time `afficherFeaturesFiltrées` is called, it completely clears all layers (`markers.clearLayers()`) and recreates them from scratch, even when only a small number of points change.

3. **Popup Creation Overhead**: Each marker has a popup bound to it with detailed HTML content, which adds significant overhead when creating thousands of markers.

4. **Icon Loading**: Each marker uses the same icon, but Leaflet loads these icons individually rather than using a sprite, which can cause performance issues.

## Solution: Leaflet.glify
Leaflet.glify is a plugin that uses WebGL to render large numbers of points efficiently. It can handle tens of thousands of points with minimal performance impact compared to traditional SVG markers.

## Implementation Steps

### 1. Replace L.geoJSON with L.glify.points
Instead of using `L.geoJSON` with individual markers, we'll use `L.glify.points` to render all points with WebGL.

### 2. Maintain Filtering Functionality
We'll need to modify the filtering logic to work with leaflet.glify while preserving all existing functionality:
- Category filtering
- Sub-category filtering
- Text search
- Popup information display

### 3. Handle Popup Information
Since leaflet.glify doesn't automatically create popups like L.geoJSON, we'll need to implement a custom solution for displaying information when points are clicked.

### 4. Maintain Existing Interface
All existing UI elements and interactions should remain unchanged:
- Category dropdown
- Sub-category dropdown
- Search functionality
- Reset button
- Spinner loading indicators

## Code Changes

### Current Code Structure:
```javascript
const coucheGeoJSON = L.geoJSON(dataFiltrée, {
  onEachFeature: function (feature, layer) {
    // Popup binding code
  },
  pointToLayer: function (feature, latlng) {
    // Marker creation code
  }
});
```

### New Implementation with leaflet.glify:
```javascript
// Convert GeoJSON data to the format expected by leaflet.glify
const glifyData = dataFiltrée.map(feature => {
  return {
    type: 'Point',
    coords: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]], // lat, lng
    properties: feature.properties
  };
});

// Create a glify layer instead of geoJSON
const glLayer = L.glify.points({
  data: glifyData,
  map: map,
  click: function (e, feature) {
    // Handle click events for displaying popups
  }
});
```

## Detailed Implementation Plan

### 1. Modify the `afficherFeaturesFiltrées` function
Replace the current implementation with one that uses leaflet.glify:

```javascript
function afficherFeaturesFiltrées(categorieFiltre, termeRecherche = "", sousCategorieFiltre = "") {
  showSpinner(); // Debut du chargement
  // Remove existing layers
  markers.clearLayers();
  
  // Remove existing glify layer if it exists
  if (window.currentGlLayer) {
    window.currentGlLayer.remove();
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

  // Add the layer to the map
  // Note: glify layers are automatically added to the map
  
  hideSpinner(); // Fin du chargement
}
```

### 2. Update Global Variables
We need to update the global variables to work with the new implementation:

```javascript
// At the top of the script, update these lines:
let allFeatures = []; // Pour stocker toutes les entités initiales
let markers = L.layerGroup(); // Still used for other layers, but not for points
```

### 3. Handle Popup Styling
Ensure the CSS for popups is still included in the project (it already is in style.css).

### 4. Test Performance Improvements
After implementing the changes, we should test with different numbers of points to verify the performance improvements.

## Benefits of This Approach

1. **Improved Performance**: WebGL rendering can handle tens of thousands of points smoothly
2. **Maintained Functionality**: All existing features like filtering and popups are preserved
3. **Better User Experience**: Faster loading and interaction with the map
4. **Scalability**: Can handle even larger datasets in the future

## Potential Challenges

1. **Popup Implementation**: Need to manually handle popup creation on click events
2. **Color Customization**: May need to implement category-based coloring
3. **Browser Compatibility**: WebGL support varies across older browsers
4. **Memory Management**: Need to properly dispose of glify layers when updating

## Next Steps

1. Switch to Code mode to implement the changes
2. Test with different numbers of points
3. Optimize popup behavior and styling
4. Implement category-based coloring if needed
5. Verify all existing functionality still works correctly
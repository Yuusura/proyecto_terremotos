async function liveEarthquakes() {
  // Llamada a API de terremotos en tiempo real
  const res = await fetch(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson", // API terremotos en tiempo real
  );
  const data = await res.json();
  data.features.forEach((feature) => {
    let earthquakesProperties = feature.properties; // Extraigo los datos de las propiedades de cada terremoto
    // Datos para añadir al popup
    const title = earthquakesProperties.title;
    const date = new Date(earthquakesProperties.time).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid", // Calcula la hora para la zona horaria de Madrid
      timeZoneName: "short", // Añade una abreviatura de la zona, como CET o CEST
    });
    const place = earthquakesProperties.place;
    const code = earthquakesProperties.code;
    const mag = earthquakesProperties.mag;
    const magType = earthquakesProperties.magType;
    let earthquakesCoordinates = feature.geometry.coordinates; // Extraigo los datos de las coordenadas de cada terremoto

    // Colores de los marcadores según su magnitud
    let markerColor = "#F0F0F0";
    if (mag >= 7) {
      markerColor = "#F817FA";
    } else if (mag >= 6) {
      markerColor = "#F61719";
    } else if (mag >= 5) {
      markerColor = "#FC9D15";
    } else if (mag >= 4) {
      markerColor = "#F6CE1E";
    } else if (mag >= 3) {
      markerColor = "#FAF016";
    } else if (mag >= 2) {
      markerColor = "#8E911C";
    } else if (mag >= 1) {
      markerColor = "#1C8919";
    }

    L.circleMarker([earthquakesCoordinates[1], earthquakesCoordinates[0]], {
      // Añado los marcadores al mapa con las coordenadas extraidas de "earthquakesCoordinates"
      radius: 2 + mag * 2, // Tamaño del marcador según la magnitud del terremoto
      stroke: false,
      fillColor: markerColor,
      fillOpacity: 0.7,
    })
      .addTo(map)
      .bindPopup(
        // Popup
        `<b>Título:</b> ${title}<br>
        <b>Fecha</b>: ${date}<br>
        <b>Ubicación</b>: ${place}<br>
        <b>Código</b>: ${code}<br>
        <b>Magnitud</b>: ${mag} ${magType}
        `,
      );
  });
}

var map = L.map("map", {
  // Creación/configuración del mapa
  center: [0, 0], // Centra el mapa en el ecuador y el meridiano de Greenwich
  zoom: 2, // Muestra una vista amplia del mundo
  minZoom: 2, // Impide alejarlo más
  maxZoom: 18, // Permite acercarte bastante
  maxBounds: [
    // Limita el movimiento
    [-85, -180],
    [85, 180],
  ],
  maxBoundsViscosity: 1.0, // Impide arrastrar el mapa más allá de los límites.
});

L.tileLayer(
  // Capa
  "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
  {
    minZoom: 0,
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  },
).addTo(map); // Añadir al mapa

// Placas tectónicas
async function tectonicPlates() { 
  const res = await fetch(
    "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json",
  );
  const data = await res.json();

  L.geoJSON(data, {
    attribution: "PB2002: Peter Bird; GeoJSON: Hugo Ahlenius / Nordpil",
    style: {
      color: "#3B3B3B",
      weight: 0.5,
    },
  }).addTo(map);
}

tectonicPlates();
liveEarthquakes(); // LLamada a la función  al final del código para que ejecute todos los datos

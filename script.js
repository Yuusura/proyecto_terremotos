import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHn8qtd-TJqpmPTgkTto0VIzSQjBuy5u8",
  authDomain: "proyectoterremotos.firebaseapp.com",
  projectId: "proyectoterremotos",
  storageBucket: "proyectoterremotos.firebasestorage.app",
  messagingSenderId: "771666579494",
  appId: "1:771666579494:web:876e83d45cb799377656e7"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Cloud Firestore con la versión 13.2.0
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
let currentUser = null;
let showingFavorites = false;
let popupHandlerAttached = false;

const authButton = document.getElementById("auth_button");
const authStatus = document.getElementById("auth_status");
const favoritesCount = document.getElementById("favorites_count");
let authStatusTimer;
let favoritesCountRequest = 0;

function renderFavoritesCount(count) {
  favoritesCount.textContent = String(count);
  favoritesCount.setAttribute("aria-label", `${count} terremotos guardados`);
}

async function updateFavoritesCount() {
  const request = ++favoritesCountRequest;
  const userId = currentUser?.uid;
  if (!userId) {
    renderFavoritesCount(0);
    return;
  }

  try {
    const favoritesQuery = query(collection(db, "proyecto_terremotos"), where("uid", "==", userId));
    const favorites = await getDocs(favoritesQuery);
    if (request === favoritesCountRequest && currentUser?.uid === userId) {
      renderFavoritesCount(favorites.size);
    }
  } catch (error) {
    console.error("Error al actualizar el contador de favoritos:", error);
  }
}

function setAuthButtonLabel(user) {
  if (user) {
    authButton.textContent = "Cerrar sesión";
    authButton.setAttribute("aria-label", "Cerrar sesión");
    return;
  }

  authButton.setAttribute("aria-label", "Iniciar sesión con Google");
  authButton.innerHTML = 'Iniciar sesión con <span class="google-word" aria-hidden="true"><span class="google-blue">G</span><span class="google-red">o</span><span class="google-yellow">o</span><span class="google-blue">g</span><span class="google-green">l</span><span class="google-red">e</span></span>';
}

function showAuthMessage(message) {
  authStatus.textContent = message;
  authStatus.classList.add("is-visible");
  window.clearTimeout(authStatusTimer);
  authStatusTimer = window.setTimeout(() => {
    authStatus.classList.remove("is-visible");
  }, 4000);
}

authButton.addEventListener("click", async () => {
  try {
    if (currentUser) await signOut(auth);
    else await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error de autenticación:", error);
    showAuthMessage("No se pudo iniciar sesión. Inténtalo de nuevo.");
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  setAuthButtonLabel(user);
  updateFavoritesCount();
  showAuthMessage(user
    ? `Sesión iniciada: ${user.displayName || user.email}`
    : "Inicia sesión para guardar y ver tus favoritos.");
  if (showingFavorites && user) showFavoriteEarthquakes();
  else if (showingFavorites && !user) {
    showingFavorites = false;
    liveEarthquakes();
  }
});

function setMapLoading(mapId, isLoading) {
  const indicator = document.querySelector(`#${mapId} .map-loading`);
  if (indicator) indicator.hidden = !isLoading;
}


// Creación del mapa principal
const map = L.map("map", {
  center: [0, 0], // Centra el mapa en el ecuador y el meridiano de Greenwich
  zoom: 2, // Muestra una vista amplia del mundo
  minZoom: 2, // Impide alejarlo más
  maxZoom: 18, // Permite acercarte bastante
  maxBounds: [
    // Limita el movimiento
    [-85, -240],
    [85, 240],
  ],
  maxBoundsViscosity: 1.0, // Impide arrastrar el mapa más allá de los límites.
});

// Capa del mapa oscuro
L.tileLayer(
  "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
  {
    minZoom: 0,
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  },
).addTo(map); // Añadir al mapa

// Llamada a API de terremotos en tiempo real
async function liveEarthquakes() {
  setMapLoading("map", true);
  try {
    const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson") // API terremotos en tiempo real
    const data = await res.json();
    if (showingFavorites) return;
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });
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

      const earthquake = {
        title,
        date,
        place,
        code,
        mag,
        magType,
        coordinates: earthquakesCoordinates,
      };
      const marker = L.circleMarker([earthquakesCoordinates[1], earthquakesCoordinates[0]], {
        // Añado los marcadores al mapa con las coordenadas extraidas de "earthquakesCoordinates"
        radius: 6 + mag * 2, // Tamaño del marcador según la magnitud del terremoto
        stroke: false,
        fillColor: markerColor,
        fillOpacity: 0.7,
      })
        .bindPopup( // Popup
          `<b>Título:</b> ${title}<br>
        <b>Fecha</b>: ${date}<br>
        <b>Ubicación</b>: ${place}<br>
        <b>Código</b>: ${code}<br>
        <b>Magnitud</b>: ${mag} ${magType}<br>
        <button id="favButton">Añadir a favoritos</button>
        `,
          {
            maxWidth: 280,
            autoPan: true,
            autoPanPadding: [20, 20],
          },
        )
        .addTo(map)
      marker.earthquake = earthquake;
    });

    //Botón para guardar en favoritos
    if (!popupHandlerAttached) {
      popupHandlerAttached = true;
      map.on("popupopen", async (event) => {
        const favButton = event.popup.getElement().querySelector("#favButton");
        const earthquake = event.popup._source.earthquake;
        if (!favButton || !earthquake) return;

        if (!currentUser) {
          favButton.textContent = "Inicia sesión para guardar";
          favButton.disabled = true;
          return;
        }

        favButton.disabled = true;
        try {
          const favorites = await getFavoriteDocs(earthquake.code);
          favButton.textContent = favorites.empty ? "Añadir a favoritos" : "Eliminar de favoritos";
          favButton.classList.toggle("remove-favorite", !favorites.empty);
        } catch (error) {
          console.error("Error al consultar favoritos en Firestore:", error);
        } finally {
          favButton.disabled = false;
        }

        favButton.addEventListener("click", async () => {
          favButton.disabled = true;
          try {
            const favorites = await getFavoriteDocs(earthquake.code);
            if (favorites.empty) {
              await saveFavorite(earthquake);
              favButton.textContent = "Eliminar de favoritos";
              favButton.classList.add("remove-favorite");
              updateFavoritesCount();
            } else {
              await Promise.all(favorites.docs.map((favorite) => deleteDoc(favorite.ref)));
              favButton.textContent = "Añadir a favoritos";
              favButton.classList.remove("remove-favorite");
              updateFavoritesCount();
            }
          } catch (error) {
            console.error("Error al actualizar favoritos en Firestore:", error);
          } finally {
            favButton.disabled = false;
          }
        });
      });
    }
  } catch (error) {
    console.error("Error al cargar los terremotos recientes:", error);
  } finally {
    setMapLoading("map", false);
  }
}

document.getElementById("show_favorites").addEventListener("click", showFavoriteEarthquakes);
document.getElementById("show_api").addEventListener("click", () => {
  showingFavorites = false;
  liveEarthquakes();
});

async function showFavoriteEarthquakes() {
  if (!currentUser) {
    showAuthMessage("Inicia sesión para ver tus terremotos favoritos.");
    return;
  }
  showingFavorites = true;
  setMapLoading("map", true);
  try {
    const favoritesQuery = query(collection(db, "proyecto_terremotos"), where("uid", "==", currentUser.uid));
    const favorites = await getDocs(favoritesQuery);
    favoritesCountRequest++;
    renderFavoritesCount(favorites.size);
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    favorites.forEach((favoriteDoc) => {
      const earthquake = favoriteDoc.data();
      if (!earthquake.coordinates || earthquake.coordinates.length < 2) return;
      const [longitude, latitude] = earthquake.coordinates;
      const mag = earthquake.mag ?? 0;
      const markerColor = mag >= 7 ? "#F817FA" : mag >= 6 ? "#F61719" : mag >= 5 ? "#FC9D15" : mag >= 4 ? "#F6CE1E" : mag >= 3 ? "#FAF016" : mag >= 2 ? "#8E911C" : mag >= 1 ? "#1C8919" : "#F0F0F0";
      const marker = L.circleMarker([latitude, longitude], {
        radius: 6 + mag * 2,
        stroke: false,
        fillColor: markerColor,
        fillOpacity: 0.7,
      }).bindPopup(
        `<b>Título:</b> ${earthquake.title}<br>
        <b>Fecha</b>: ${earthquake.date}<br>
        <b>Ubicación</b>: ${earthquake.place}<br>
        <b>Código</b>: ${earthquake.code}<br>
        <b>Magnitud</b>: ${mag} ${earthquake.magType}<br>
        <button class="favorite-toggle">Eliminar de favoritos</button>`,
      ).addTo(map);

      marker.on("popupopen", (event) => {
        event.popup.getElement().querySelector(".favorite-toggle")?.addEventListener("click", async (clickEvent) => {
          const button = clickEvent.currentTarget;
          button.disabled = true;
          try {
            const docs = await getFavoriteDocs(earthquake.code);
            await Promise.all(docs.docs.map((favorite) => deleteDoc(favorite.ref)));
            updateFavoritesCount();
            marker.closePopup();
            map.removeLayer(marker);
          } catch (error) {
            console.error("Error al eliminar el favorito de Firestore:", error);
            button.disabled = false;
          }
        }, { once: true });
      });
      marker.earthquake = earthquake;
    });
  } catch (error) {
    console.error("Error al cargar favoritos de Firestore:", error);
  } finally {
    setMapLoading("map", false);
  }
}

// Placas tectónicas
async function tectonicPlates(insertMap) { // Función reutilizable
  const res = await fetch("https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json")
  const data = await res.json();

  L.geoJSON(data, {
    attribution: "PB2002: Peter Bird; GeoJSON: Hugo Ahlenius / Nordpil",
    style: {
      color: "#F7F8F0",
      weight: 0.2,
    },
  }).addTo(insertMap);
}

// Llamada a API de terremotos totales
async function filtredEarthquakes() {
  setMapLoading("map_filtered", true);
  try {
    let url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"; // API terremotos totales

    // Leemos las fechas que ha elegido la persona en el formulario.
    const startDate = document.getElementById("start_date").value;
    const endDate = document.getElementById("end_date").value;

    if (startDate) { // Si hay una fecha de inicio, se añade a la dirección
      url += `&starttime=${startDate}`;
    }

    if (endDate) { // Si hay una fecha final, se añade a la dirección
      url += `&endtime=${endDate}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    const selectedMag = document.querySelector('input[name="mag"]:checked').value;

    const filteredFeatures = data.features.filter((feature) => {
      const mag = feature.properties.mag;

      if (selectedMag === "all") {
        0
        return true;
      }

      if (selectedMag === "7+") {
        return mag >= 7;
      }

      // Por ejemplo, convierte "2-3" en los números 2 y 3.
      const [min, max] = selectedMag.split("-").map(Number);

      return mag >= min && mag < max;
    });

    map_filtered.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        map_filtered.removeLayer(layer);
      }
    });



    filteredFeatures.forEach((feature) => {
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
        radius: 4 + mag * 2, // Tamaño del marcador según la magnitud del terremoto
        stroke: false,
        fillColor: markerColor,
        fillOpacity: 0.7,
      })
        .bindPopup(
          // Popup
          `<b>Título:</b> ${title}<br>
        <b>Fecha</b>: ${date}<br>
        <b>Ubicación</b>: ${place}<br>
        <b>Código</b>: ${code}<br>
        <b>Magnitud</b>: ${mag} ${magType}
        `,
          {
            maxWidth: 280,
            autoPan: true,
            autoPanPadding: [20, 20],
          },
        )
        .addTo(map_filtered);
    });
  } catch (error) {
    console.error("Error al cargar el mapa filtrado:", error);
  } finally {
    setMapLoading("map_filtered", false);
  }
}

// Creación del mapa filtrado
const map_filtered = L.map("map_filtered", {
  center: [0, 0],
  zoom: 2,
  minZoom: 2,
  maxZoom: 18,
  maxBounds: [
    [-85, -240],
    [85, 240],
  ],
  maxBoundsViscosity: 1.0,
});

//Capa del mapa claro
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
  minZoom: 0,
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  ext: 'png'
}).addTo(map_filtered);

// Botón tipo "swipe"
const swipe = document.getElementById("swipe");
swipe.addEventListener("click", () => {
  const main_half = document.getElementById("main_half");
  const secondary_half = document.getElementById("secondary_half");

  if (main_half.getBoundingClientRect().top >= 0) {
    secondary_half.scrollIntoView({ behavior: "smooth" });
    swipe.textContent = "Filtrar terremotos ↓";
  } else {
    main_half.scrollIntoView({ behavior: "smooth" });
    swipe.textContent = "Últimas 24h ↑";
  }

  if (secondary_half.getBoundingClientRect().top >= 0) {
    secondary_half.scrollIntoView({ behavior: "smooth" });
    swipe.textContent = "Últimas 24h ↑";
  } else {
    main_half.scrollIntoView({ behavior: "smooth" });
    swipe.textContent = "Filtrar terremotos ↓";
  }
});

//Botón de buscar datos filtrados
let search_button = document.getElementById("search_button");
search_button.addEventListener("click", function (event) {
  event.preventDefault(); // Evita que el formulario recargue la página
  filtredEarthquakes();  // Vuelve a buscar usando las fechas y la magnitud seleccionadas
});

//Funcion para guardar los favoritos en la bbdd de firebase
async function saveFavorite(favoriteEarthquake) {
  if (!currentUser) throw new Error("Es necesario iniciar sesión para guardar favoritos.");
  await addDoc(collection(db, "proyecto_terremotos"), {
    uid: currentUser.uid,
    code: favoriteEarthquake.code,
    coordinates: favoriteEarthquake.coordinates,
    date: favoriteEarthquake.date,
    mag: favoriteEarthquake.mag,
    magType: favoriteEarthquake.magType,
    place: favoriteEarthquake.place,
    title: favoriteEarthquake.title,
  });
}

// Busca por el código USGS para detectar también favoritos guardados anteriormente.
function getFavoriteDocs(earthquakeCode) {
  if (!currentUser) return Promise.reject(new Error("Es necesario iniciar sesión para consultar favoritos."));
  const favoritesQuery = query(
    collection(db, "proyecto_terremotos"),
    where("code", "==", earthquakeCode),
    where("uid", "==", currentUser.uid),
  );
  return getDocs(favoritesQuery);
}



// LLamadas a las funciones  al final del código para que se ejecuten todos los datos previamente
tectonicPlates(map);
tectonicPlates(map_filtered);
filtredEarthquakes()
liveEarthquakes(); 

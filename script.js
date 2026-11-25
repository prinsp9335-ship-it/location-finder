const SHEET_ID = "1u7RN-0d34sy01gXlJjc16C-ZTOdsQPj94X9NXSWabqo";

document.getElementById("ids").addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        findOutlets();
    }
});

let outletsData = [], map, routePolyline;

const bluePinIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findOutlets() {
    const rawIds = document.getElementById("ids").value;
    const findBtn = document.getElementById("findBtn");
    if (!rawIds) return alert("Bhai, IDs toh dalo!");

    findBtn.innerText = "Searching...";
    findBtn.disabled = true;

    const ids = rawIds.split(/[\s,]+/).map(x => x.trim()).filter(x => x);

    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const userLat = pos.coords.latitude;
            const userLon = pos.coords.longitude;
            const res = await fetch(`https://opensheet.elk.sh/${SHEET_ID}/location`);
            const data = await res.json();
            let filtered = data.filter(d => ids.includes(String(d["Outlet Id"])));

            if (!filtered.length) {
                alert("No data found");
            } else {
                let sorted = [];
                let pool = [...filtered];
                let currentLat = userLat;
                let currentLon = userLon;

                while (pool.length > 0) {
                    let nearestIdx = 0;
                    let minDist = Infinity;
                    for (let i = 0; i < pool.length; i++) {
                        let d = getDistance(currentLat, currentLon, parseFloat(pool[i].Latitude), parseFloat(pool[i].Longitude));
                        if (d < minDist) { minDist = d; nearestIdx = i; }
                    }
                    let chosen = pool.splice(nearestIdx, 1)[0];
                    sorted.push({
                        name: chosen["Outlet Name"],
                        address: chosen["Address"],
                        lat: parseFloat(chosen.Latitude),
                        lng: parseFloat(chosen.Longitude),
                        link: chosen["Location"],
                        distFromPrev: minDist
                    });
                    currentLat = sorted[sorted.length - 1].lat;
                    currentLon = sorted[sorted.length - 1].lng;
                }
                outletsData = sorted;
                renderResults();
                document.getElementById("mapBtn").style.display = "block";
                document.getElementById("copyMapLinkBtn").style.display = "block";
                document.getElementById("routeBtn").style.display = "block";
                document.getElementById("copyAllBtn").style.display = "block";
            }
        } catch (e) {
            alert("Error!");
        } finally {
            findBtn.innerText = "Find Outlets (or Press Enter)";
            findBtn.disabled = false;
        }
    });
}

function renderResults() {
    const ul = document.getElementById("result");
    ul.innerHTML = "";
    outletsData.forEach((r, index) => {
        const li = document.createElement("li");
        const distLabel = index === 0 ? "Distance from You" : "Distance from last shop";

        li.innerHTML = `
            <div class="content-area">
                <div class="name">${index + 1}. ${r.name}</div>
                <div class="address">${r.address || "No Address"}</div>
                <div class="dist-info"><b>${distLabel}:</b> ${r.distFromPrev.toFixed(2)} km</div>
                <a class="maps-link" href="${r.link}" target="_blank"> 📍 Open Location</a>
            </div>
            <div class="action-btns">
                <button class="remove-btn" onclick="removeItem(${index})">×</button>
                <button class="copy-single-btn" onclick="copySingle(${index})">Copy</button>
            </div>
        `;
        ul.appendChild(li);
    });
}

function copySingle(index) {
    const r = outletsData[index];
    const text = `🏪 *${r.name}*\n📍 Address: ${r.address}\n📏 Dist: ${r.distFromPrev.toFixed(2)} km\n🔗 Location: ${r.link}`;
    copyToClipboard(text);
}

function copyAllDetails() {
    if (outletsData.length === 0) return;
    let fullText = "📋 *ALL OUTLET DETAILS* 📋\n\n";
    outletsData.forEach((r, i) => {
        fullText += `${i + 1}. *${r.name}*\n📍 ${r.address}\n🔗 ${r.link}\n------------------\n`;
    });
    copyToClipboard(fullText);
}

function copyMapLink() {
    if (outletsData.length === 0) return;
    navigator.geolocation.getCurrentPosition(pos => {
        let baseUrl = "https://www.google.com/maps/dir/";
        let points = [`${pos.coords.latitude},${pos.coords.longitude}`];
        outletsData.forEach(o => {
            if (o.lat && o.lng) {
                points.push(`${o.lat},${o.lng}`);
            }
        });
        let fullMapUrl = baseUrl + points.join("/");
        let shareText = `📍 *Full Route Map Link* 📍\n\nIs link par click karke poora route maps me dekhein:\n🔗 ${fullMapUrl}`;
        copyToClipboard(shareText);
    });
}

function copyMapRouteInfo() {
    copyMapLink();
}

function toggleFullScreenMap() {
    const mapEl = document.getElementById("map");
    if (!document.fullscreenElement) {
        if (mapEl.requestFullscreen) {
            mapEl.requestFullscreen().then(() => setTimeout(() => map && map.invalidateSize(), 200));
        }
    } else if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setTimeout(() => map && map.invalidateSize(), 200));
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Copied to clipboard! Ab WhatsApp pe paste kar do.");
    }).catch(() => {
        alert("Copy failed!");
    });
}

function removeItem(index) {
    outletsData.splice(index, 1);
    renderResults();
}

function showAllOnMap() {
    document.getElementById("map-wrapper").style.display = "block";
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!map) {
            map = L.map('map').setView([lat, lng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        } else {
            map.setView([lat, lng], 13);
            setTimeout(() => map.invalidateSize(), 100);
        }

        map.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });

        L.marker([lat, lng], { icon: bluePinIcon })
            .addTo(map)
            .bindPopup("You")
            .bindTooltip("You", { permanent: true, direction: "top", className: "outlet-label" });

        const routeCoords = [[lat, lng]];

        outletsData.forEach((o, idx) => {
            if (o.lat && o.lng) {
                routeCoords.push([o.lat, o.lng]);
                let marker = L.marker([o.lat, o.lng], { icon: bluePinIcon })
                    .addTo(map)
                    .bindTooltip(`${idx + 1}. ${o.name}`, { permanent: true, direction: "top", className: "outlet-label" });
                marker.on('click', () => window.open(`https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`, "_blank"));
            }
        });

        if (routeCoords.length > 1) {
            routePolyline = L.polyline(routeCoords, { color: "#1a73e8", weight: 4, opacity: 0.85 }).addTo(map);
            map.fitBounds(routePolyline.getBounds(), { padding: [35, 35] });
        }
    });
}

function openFullRoute() {
    navigator.geolocation.getCurrentPosition(pos => {
        let points = [`${pos.coords.latitude},${pos.coords.longitude}`];
        outletsData.forEach(o => points.push(`${o.lat},${o.lng}`));
        window.open("https://www.google.com/maps/dir/" + points.join("/"), "_blank");
    });
}
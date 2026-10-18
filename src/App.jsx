import React, { useState, useEffect, useMemo } from "react";
import "./App.css";

const API_Key = "329dbc6a652ddc164f448a2c41589ae7";

/* ---------- helpers ---------- */
const getTheme = (weather) => {
  if (!weather) return "default";
  const main = weather.weather[0].main.toLowerCase();
  const isNight = weather.weather[0].icon.endsWith("n");

  if (main === "clear") return isNight ? "night" : "clear";
  if (main === "clouds") return "clouds";
  if (main === "rain" || main === "drizzle") return "rain";
  if (main === "thunderstorm") return "storm";
  if (main === "snow") return "snow";
  return "mist";
};

const formatTime = (unix, offset) =>
  new Date((unix + offset) * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

const formatLocalNow = (unix, offset) =>
  new Date((unix + offset) * 1000).toLocaleString("en-US", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

const windDirection = (deg) => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
};

/* number ko 0 se target tak animate karta hai */
const useCountUp = (target, duration = 900) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
};

/* ---------- background effects ---------- */
const Effects = ({ theme }) => {
  const drops = useMemo(
    () =>
      Array.from({ length: 80 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 2,
        dur: 0.55 + Math.random() * 0.5,
        opacity: 0.3 + Math.random() * 0.5,
      })),
    []
  );

  const flakes = useMemo(
    () =>
      Array.from({ length: 55 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 8,
        dur: 7 + Math.random() * 7,
        size: 4 + Math.random() * 8,
      })),
    []
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 4,
        size: 1 + Math.random() * 2.5,
      })),
    []
  );

  const showRain = theme === "rain" || theme === "storm";
  const showClouds = ["clouds", "rain", "storm", "mist", "clear"].includes(theme);
  const showStars = theme === "night" || theme === "default";

  return (
    <div className="effects" aria-hidden="true">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      {theme === "clear" && <div className="sun"></div>}
      {theme === "night" && <div className="moon"></div>}

      {showStars &&
        stars.map((s, i) => (
          <span
            key={i}
            className="star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

      {showClouds && (
        <>
          <div className="cloud cloud-1"></div>
          <div className="cloud cloud-2"></div>
          <div className="cloud cloud-3"></div>
        </>
      )}

      {showRain &&
        drops.map((d, i) => (
          <span
            key={i}
            className="drop"
            style={{
              left: `${d.left}%`,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
              opacity: d.opacity,
            }}
          />
        ))}

      {theme === "storm" && <div className="lightning"></div>}

      {theme === "snow" &&
        flakes.map((f, i) => (
          <span
            key={i}
            className="flake"
            style={{
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              animationDuration: `${f.dur}s`,
              animationDelay: `${f.delay}s`,
            }}
          />
        ))}
    </div>
  );
};

/* ---------- main app ---------- */
const App = () => {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);

  /* purani searches wapas lao */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("recentSearches"));
      if (Array.isArray(saved)) setRecent(saved);
    } catch (e) {
      // ignore
    }
  }, []);

  const saveRecent = (name) => {
    const updated = [name, ...recent.filter((r) => r.toLowerCase() !== name.toLowerCase())].slice(0, 5);
    setRecent(updated);
    try {
      localStorage.setItem("recentSearches", JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const getCity = async (term) => {
    setError("");
    setWeather(null);

    const q = (term ?? city).trim();

    if (!q) {
      setError("Please enter a city or country name");
      return;
    }

    setLoading(true);

    try {
      let lat, lon, placeName;

      // Step 1: pehle country try kar
      try {
        const countryResponse = await fetch(
          `https://restcountries.com/v3.1/name/${encodeURIComponent(
            q
          )}?fullText=true&fields=name,capital,capitalInfo`
        );

        if (countryResponse.ok) {
          const countryData = await countryResponse.json();
          const c = countryData[0];

          if (c?.capitalInfo?.latlng?.length === 2) {
            lat = c.capitalInfo.latlng[0];
            lon = c.capitalInfo.latlng[1];
            placeName = `${c.capital[0]}, ${c.name.common}`;
          }
        }
      } catch (countryError) {
        // country API fail ho to city search chalne de
      }

      // Step 2: country nahi mili to city try kar
      if (lat === undefined) {
        const response = await fetch(
          `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
            q
          )}&limit=1&appid=${API_Key}`
        );

        if (!response.ok) {
          throw new Error("Unable to search. Please try again.");
        }

        const data = await response.json();

        if (data.length === 0) {
          setError("City or country not found. Please check the spelling.");
          return;
        }

        lat = data[0].lat;
        lon = data[0].lon;
        placeName = `${data[0].name}, ${data[0].country}`;
      }

      // Step 3: weather nikal
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_Key}`
      );

      if (!weatherResponse.ok) {
        throw new Error("Unable to fetch weather. Please try again.");
      }

      const weatherData = await weatherResponse.json();

      setWeather({ ...weatherData, name: placeName });
      saveRecent(q.charAt(0).toUpperCase() + q.slice(1));
      setCity("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const theme = getTheme(weather);
  const animatedTemp = useCountUp(weather ? Math.round(weather.main.temp) : 0);

  const stats = weather
    ? [
        { icon: "🌡️", label: "Feels Like", value: `${Math.round(weather.main.feels_like)}°C` },
        { icon: "💧", label: "Humidity", value: `${weather.main.humidity}%` },
        {
          icon: "💨",
          label: "Wind",
          value: `${weather.wind.speed} m/s ${weather.wind.deg !== undefined ? windDirection(weather.wind.deg) : ""}`,
        },
        { icon: "🧭", label: "Pressure", value: `${weather.main.pressure} hPa` },
        { icon: "🌅", label: "Sunrise", value: formatTime(weather.sys.sunrise, weather.timezone) },
        { icon: "🌇", label: "Sunset", value: formatTime(weather.sys.sunset, weather.timezone) },
      ]
    : [];

  return (
    <div className={`app theme-${theme}`}>
      <Effects theme={theme} />

      <main className="card">
        <header className="header">
          <h1 className="title">
            Weather<span>Now</span>
          </h1>
          <p className="subtitle">Live weather for any city or country</p>
        </header>

        {/* search */}
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search Karachi, Pakistan..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") getCity();
            }}
          />
          <button onClick={() => getCity()} disabled={loading}>
            {loading ? "..." : "Search"}
          </button>
        </div>

        {/* recent chips */}
        {recent.length > 0 && (
          <div className="chips">
            {recent.map((r) => (
              <button key={r} className="chip" onClick={() => getCity(r)} disabled={loading}>
                {r}
              </button>
            ))}
          </div>
        )}

        {/* loading skeleton */}
        {loading && (
          <div className="skeleton">
            <div className="sk sk-title"></div>
            <div className="sk sk-temp"></div>
            <div className="sk-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="sk sk-tile"></div>
              ))}
            </div>
          </div>
        )}

        {/* error */}
        {error && <p className="error">{error}</p>}

        {/* empty state */}
        {!weather && !loading && !error && (
          <div className="empty">
            <div className="globe">🌍</div>
            <p>Search a place to see live weather</p>
          </div>
        )}

        {/* result */}
        {weather && !loading && (
          <section className="result">
            <div className="place-row">
              <h2 className="place">{weather.name}</h2>
              <span className="local-time">{formatLocalNow(weather.dt, weather.timezone)}</span>
            </div>

            <div className="hero">
              <img
                className="weather-icon"
                src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`}
                alt={weather.weather[0].description}
              />
              <div className="hero-text">
                <div className="temp">
                  {animatedTemp}
                  <span className="deg">°C</span>
                </div>
                <div className="condition">{weather.weather[0].description}</div>
              </div>
            </div>

            <div className="hl">
              <span className="pill">▲ High {Math.round(weather.main.temp_max)}°</span>
              <span className="pill">▼ Low {Math.round(weather.main.temp_min)}°</span>
            </div>

            <div className="stats">
              {stats.map((s, i) => (
                <div className="stat" key={s.label} style={{ "--i": i }}>
                  <span className="stat-icon">{s.icon}</span>
                  <span className="stat-label">{s.label}</span>
                  <span className="stat-value">{s.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
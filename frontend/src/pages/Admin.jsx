import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './Admin.module.css';
import { API_BASE } from '../apiBase';

export default function Admin() {
  const { getAuthHeader } = useAuth();
  const [activeTab, setActiveTab] = useState('movie');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [pricing, setPricing] = useState({ weekendMultiplier: 1.2, infantDiscountMultiplier: 0.5 });

  // Movie form
  const [movie, setMovie] = useState({ title: '', genre: '', duration: '', rating: 'PG-13', showtimes: '10:00 AM, 2:00 PM, 6:00 PM', price: '' });
  // Hotel form
  const [hotel, setHotel] = useState({ name: '', city: '', stars: 4, pricePerNight: '', amenities: 'Pool, WiFi, Breakfast', image: '' });
  // Travel form
  const [travel, setTravel] = useState({
    type: 'Flight',
    from: '',
    to: '',
    date: '',
    price: '',
    carrier: '',
    flightCategory: 'domestic',
    departureLocalTime: '',
    arrivalLocalTime: '',
    departureTimezone: '',
    arrivalTimezone: '',
  });

  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/settings/pricing`)
      .then((r) => r.json())
      .then((data) => setPricing({
        weekendMultiplier: data.weekendMultiplier ?? 1.2,
        infantDiscountMultiplier: data.infantDiscountMultiplier ?? 0.5,
      }))
      .catch(() => {});
  }, []);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleAddMovie = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const showtimes = movie.showtimes.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/api/admin/movies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          title: movie.title,
          genre: movie.genre,
          duration: movie.duration,
          rating: movie.rating,
          showtimes,
          price: Number(movie.price),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add movie');
      }
      showMsg('success', 'Movie added successfully. It will appear on the Movies page.');
      setMovie({ ...movie, title: '', genre: '', duration: '', showtimes: '10:00 AM, 2:00 PM, 6:00 PM', price: '' });
    } catch (err) {
      showMsg('error', err.message || 'Failed to add movie');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddHotel = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const amenities = hotel.amenities.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/api/admin/hotels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          name: hotel.name,
          city: hotel.city,
          stars: Number(hotel.stars),
          pricePerNight: Number(hotel.pricePerNight),
          amenities,
          image: hotel.image,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add hotel');
      }
      showMsg('success', 'Hotel added successfully. It will appear on the Hotels page.');
      setHotel({ ...hotel, name: '', city: '', pricePerNight: '', image: '' });
    } catch (err) {
      showMsg('error', err.message || 'Failed to add hotel');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTravel = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/admin/travels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          type: travel.type,
          from: travel.from,
          to: travel.to,
          date: travel.date,
          price: Number(travel.price),
          carrier: travel.carrier,
          flightCategory: travel.flightCategory,
          departureLocalTime: travel.departureLocalTime,
          arrivalLocalTime: travel.arrivalLocalTime,
          departureTimezone: travel.departureTimezone,
          arrivalTimezone: travel.arrivalTimezone,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add travel route');
      }
      showMsg('success', 'Travel route added successfully. It will appear on the Travel page.');
      setTravel({
        ...travel,
        from: '',
        to: '',
        date: '',
        price: '',
        carrier: '',
        departureLocalTime: '',
        arrivalLocalTime: '',
        departureTimezone: '',
        arrivalTimezone: '',
      });
    } catch (err) {
      showMsg('error', err.message || 'Failed to add travel route');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePricing = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          weekendMultiplier: Number(pricing.weekendMultiplier),
          infantDiscountMultiplier: Number(pricing.infantDiscountMultiplier),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save pricing settings');
      }
      showMsg('success', 'Pricing settings updated successfully.');
    } catch (err) {
      showMsg('error', err.message || 'Failed to save pricing settings');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Admin</h1>
      <p className={styles.lead}>Add new movies, hotels, and travel routes. Changes appear immediately for all users.</p>

      {message.text && (
        <div className={message.type === 'error' ? styles.errorMsg : styles.successMsg}>{message.text}</div>
      )}

      <div className={styles.tabs}>
        <button type="button" className={activeTab === 'movie' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('movie')}>Add Movie</button>
        <button type="button" className={activeTab === 'hotel' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('hotel')}>Add Hotel</button>
        <button type="button" className={activeTab === 'travel' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('travel')}>Add Travel Route</button>
        <button type="button" className={activeTab === 'pricing' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('pricing')}>Pricing Settings</button>
      </div>

      {activeTab === 'movie' && (
        <form onSubmit={handleAddMovie} className={styles.form}>
          <h2>Add a movie</h2>
          <label>Title <input value={movie.title} onChange={e => setMovie({ ...movie, title: e.target.value })} required placeholder="e.g. The New Blockbuster" /></label>
          <label>Genre <input value={movie.genre} onChange={e => setMovie({ ...movie, genre: e.target.value })} required placeholder="e.g. Action, Comedy" /></label>
          <label>Duration <input value={movie.duration} onChange={e => setMovie({ ...movie, duration: e.target.value })} required placeholder="e.g. 2h 15m" /></label>
          <label>Rating <select value={movie.rating} onChange={e => setMovie({ ...movie, rating: e.target.value })}><option value="G">G</option><option value="PG">PG</option><option value="PG-13">PG-13</option><option value="R">R</option></select></label>
          <label>Showtimes (comma-separated) <input value={movie.showtimes} onChange={e => setMovie({ ...movie, showtimes: e.target.value })} required placeholder="10:00 AM, 2:00 PM, 6:00 PM" /></label>
          <label>Price per ticket (₹) <input type="number" min="1" step="0.5" value={movie.price} onChange={e => setMovie({ ...movie, price: e.target.value })} required placeholder="12" /></label>
          <button type="submit" className={styles.submit} disabled={submitting}>{submitting ? 'Adding…' : 'Add movie'}</button>
        </form>
      )}

      {activeTab === 'hotel' && (
        <form onSubmit={handleAddHotel} className={styles.form}>
          <h2>Add a hotel</h2>
          <label>Hotel name <input value={hotel.name} onChange={e => setHotel({ ...hotel, name: e.target.value })} required placeholder="e.g. Riverside Suites" /></label>
          <label>City <input value={hotel.city} onChange={e => setHotel({ ...hotel, city: e.target.value })} required placeholder="e.g. Seattle" /></label>
          <label>Stars (1–5) <input type="number" min="1" max="5" value={hotel.stars} onChange={e => setHotel({ ...hotel, stars: e.target.value })} /></label>
          <label>Price per night (₹) <input type="number" min="1" value={hotel.pricePerNight} onChange={e => setHotel({ ...hotel, pricePerNight: e.target.value })} required placeholder="99" /></label>
          <label>Amenities (comma-separated) <input value={hotel.amenities} onChange={e => setHotel({ ...hotel, amenities: e.target.value })} placeholder="Pool, WiFi, Breakfast" /></label>
          <label>Image URL (optional) <input value={hotel.image} onChange={e => setHotel({ ...hotel, image: e.target.value })} placeholder="https://example.com/hotel.jpg" /></label>
          <button type="submit" className={styles.submit} disabled={submitting}>{submitting ? 'Adding…' : 'Add hotel'}</button>
        </form>
      )}

      {activeTab === 'travel' && (
        <form onSubmit={handleAddTravel} className={styles.form}>
          <h2>Add a travel route</h2>
          <label>Type <select value={travel.type} onChange={e => setTravel({ ...travel, type: e.target.value })}><option value="Flight">Flight</option><option value="Train">Train</option><option value="Bus">Bus</option></select></label>
          <label>From <input value={travel.from} onChange={e => setTravel({ ...travel, from: e.target.value })} required placeholder="e.g. NYC" /></label>
          <label>To <input value={travel.to} onChange={e => setTravel({ ...travel, to: e.target.value })} required placeholder="e.g. Miami" /></label>
          <label>Date <input type="date" value={travel.date} onChange={e => setTravel({ ...travel, date: e.target.value })} required /></label>
          <label>Price (₹) <input type="number" min="1" value={travel.price} onChange={e => setTravel({ ...travel, price: e.target.value })} required placeholder="149" /></label>
          <label>Carrier / operator <input value={travel.carrier} onChange={e => setTravel({ ...travel, carrier: e.target.value })} required placeholder="e.g. SkyWays, Amtrak" /></label>
          {travel.type === 'Flight' && (
            <>
              <label>Flight category
                <select value={travel.flightCategory} onChange={e => setTravel({ ...travel, flightCategory: e.target.value })}>
                  <option value="domestic">Domestic</option>
                  <option value="international">International</option>
                </select>
              </label>
              <label>Departure local time <input value={travel.departureLocalTime} onChange={e => setTravel({ ...travel, departureLocalTime: e.target.value })} placeholder="e.g. 09:30 AM" /></label>
              <label>Arrival local time <input value={travel.arrivalLocalTime} onChange={e => setTravel({ ...travel, arrivalLocalTime: e.target.value })} placeholder="e.g. 12:45 PM" /></label>
              <label>Departure timezone <input value={travel.departureTimezone} onChange={e => setTravel({ ...travel, departureTimezone: e.target.value })} placeholder="e.g. IST (UTC+5:30)" /></label>
              <label>Arrival timezone <input value={travel.arrivalTimezone} onChange={e => setTravel({ ...travel, arrivalTimezone: e.target.value })} placeholder="e.g. GMT (UTC+0)" /></label>
            </>
          )}
          <button type="submit" className={styles.submit} disabled={submitting}>{submitting ? 'Adding…' : 'Add travel route'}</button>
        </form>
      )}

      {activeTab === 'pricing' && (
        <form onSubmit={handleSavePricing} className={styles.form}>
          <h2>Dynamic Pricing Settings</h2>
          <label>
            Weekend Multiplier (e.g. 1.2 for +20%)
            <input
              type="number"
              step="0.01"
              min="1"
              value={pricing.weekendMultiplier}
              onChange={(e) => setPricing({ ...pricing, weekendMultiplier: e.target.value })}
              required
            />
          </label>
          <label>
            Infant Discount Multiplier (0 to 1, e.g. 0.5 for 50%)
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={pricing.infantDiscountMultiplier}
              onChange={(e) => setPricing({ ...pricing, infantDiscountMultiplier: e.target.value })}
              required
            />
          </label>
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Pricing Settings'}
          </button>
        </form>
      )}
    </div>
  );
}

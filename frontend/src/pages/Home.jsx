import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Home.module.css';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Welcome back, {user?.name || 'Guest'}</h1>
      <p className={styles.lead}>Choose what you'd like to book today.</p>
      <div className={styles.grid}>
        <Link to="/movies" className={styles.card}>
          <span className={styles.icon}>🎬</span>
          <h2>Movies</h2>
          <p>Book cinema tickets and pick your showtime.</p>
        </Link>
        <Link to="/hotels" className={styles.card}>
          <span className={styles.icon}>🏨</span>
          <h2>Hotels</h2>
          <p>Find and reserve hotels by city and dates.</p>
        </Link>
        <Link to="/travel" className={styles.card}>
          <span className={styles.icon}>✈️</span>
          <h2>Travel</h2>
          <p>Flights, trains, and buses in one place.</p>
        </Link>
      </div>
      <Link to="/bookings" className={styles.bookingsLink}>View my bookings →</Link>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './MyBookings.module.css';
import { API_BASE } from '../apiBase';

export default function MyBookings() {
  const { getAuthHeader } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/bookings`, { headers: getAuthHeader() })
      .then((r) => r.json())
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [getAuthHeader]);

  if (loading) return <div className={styles.loading}>Loading your bookings…</div>;

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>My Bookings</h1>
      <p className={styles.lead}>View and download receipts for your bookings.</p>
      {bookings.length === 0 ? (
        <div className={styles.empty}>
          <p>You don't have any bookings yet.</p>
          <Link to="/">Book a movie, hotel, or travel</Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {bookings.map((b) => (
            <li key={b.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.id}>{b.id}</span>
                <span className={styles.type}>{b.type}</span>
                <span className={styles.amount}>₹{b.totalAmount}</span>
              </div>
              <div className={styles.itemDetails}>
                {b.type === 'movie' && (
                  <span>{b.details?.movie} · {b.details?.showtime} · {b.details?.tickets} ticket(s)</span>
                )}
                {b.type === 'hotel' && (
                  <span>{b.details?.hotel} · {b.details?.city} · {b.details?.nights} night(s)</span>
                )}
                {b.type === 'travel' && (
                  <span>{b.details?.type} · {b.details?.from} → {b.details?.to} · {b.details?.date}</span>
                )}
              </div>
              <Link to={`/receipt/${b.id}`} className={styles.receiptLink}>View receipt</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

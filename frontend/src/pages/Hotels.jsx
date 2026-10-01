import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './Booking.module.css';
import { API_BASE } from '../apiBase';

export default function Hotels() {
  const { getAuthHeader } = useAuth();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [nights, setNights] = useState(1);
  const [step, setStep] = useState('list');
  const [paying, setPaying] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsMeta, setReviewsMeta] = useState({ averageRating: 0, count: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/hotels`)
      .then((r) => r.json())
      .then(setHotels)
      .finally(() => setLoading(false));
  }, []);

  const total = selected ? selected.pricePerNight * nights : 0;

  const loadReviews = async (hotelId) => {
    setReviewsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/hotels/${hotelId}/reviews`);
      if (!res.ok) throw new Error('Unable to load reviews');
      const data = await res.json();
      setReviews(data.reviews || []);
      setReviewsMeta({ averageRating: data.averageRating || 0, count: data.count || 0 });
    } catch {
      setReviews([]);
      setReviewsMeta({ averageRating: 0, count: 0 });
    } finally {
      setReviewsLoading(false);
    }
  };

  const handlePay = async () => {
    setPaying(true);
    try {
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          type: 'hotel',
          details: {
            hotelId: selected.id,
            hotel: selected.name,
            city: selected.city,
            stars: selected.stars,
            nights,
            pricePerNight: selected.pricePerNight,
            amenities: selected.amenities,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setBookingId(data.id);
      setStep('done');
    } catch (e) {
      alert(e.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/hotels/${selected.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit review');
      }
      setReviewComment('');
      setReviewRating(5);
      await loadReviews(selected.id);
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading hotels…</div>;

  if (step === 'done' && bookingId) {
    window.location.href = `/receipt/${bookingId}`;
    return <div className={styles.loading}>Redirecting to receipt…</div>;
  }

  if (step === 'confirm') {
    return (
      <div className={styles.page}>
        <h1 className={styles.h1}>Confirm & Pay</h1>
        <div className={styles.summary}>
          {selected.image && <img className={styles.hotelImage} src={selected.image} alt={selected.name} />}
          <h2>{selected.name}</h2>
          <p>{selected.city} · {'★'.repeat(selected.stars)}</p>
          <p>{nights} night(s) × ₹{selected.pricePerNight} = <strong>₹{total}</strong></p>
        </div>
        <div className={styles.summary}>
          <h2>Guest Reviews</h2>
          <p>
            {reviewsMeta.count > 0
              ? `${reviewsMeta.averageRating.toFixed(1)} / 5 from ${reviewsMeta.count} review(s)`
              : 'No reviews yet for this hotel.'}
          </p>
          {reviewsLoading ? (
            <p className={styles.meta}>Loading reviews…</p>
          ) : (
            <div className={styles.reviewsList}>
              {reviews.map((r) => (
                <div key={r.id} className={styles.reviewItem}>
                  <p><strong>{'★'.repeat(r.rating)}</strong> by {r.userName}</p>
                  {r.comment && <p>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmitReview} className={styles.reviewForm}>
            <label>
              Rating
              <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>
                <option value={5}>5 stars</option>
                <option value={4}>4 stars</option>
                <option value={3}>3 stars</option>
                <option value={2}>2 stars</option>
                <option value={1}>1 star</option>
              </select>
            </label>
            <label>
              Feedback
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience"
                rows={3}
              />
            </label>
            <button type="submit" className={styles.secondary} disabled={reviewSubmitting}>
              {reviewSubmitting ? 'Submitting…' : 'Submit review'}
            </button>
          </form>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => setStep('list')}>Back</button>
          <button type="button" className={styles.primary} onClick={handlePay} disabled={paying}>
            {paying ? 'Processing…' : `Pay ₹${total}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Book a hotel</h1>
      <p className={styles.lead}>Choose a hotel and number of nights.</p>
      <div className={styles.grid}>
        {hotels.map((h) => (
          <div key={h.id} className={styles.card}>
            {h.image && <img className={styles.hotelImage} src={h.image} alt={h.name} />}
            <h3>{h.name}</h3>
            <p className={styles.meta}>{h.city} · {'★'.repeat(h.stars)}</p>
            <p className={styles.amenities}>{h.amenities?.join(' · ')}</p>
            <p className={styles.price}>₹{h.pricePerNight} <span>/ night</span></p>
            <div className={styles.tickets}>
              <label>Nights:</label>
              <input
                type="number"
                min={1}
                max={14}
                value={nights}
                onChange={(e) => setNights(Number(e.target.value) || 1)}
              />
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setSelected(h);
                setStep('confirm');
                loadReviews(h.id);
              }}
            >
              Book for ₹{h.pricePerNight * nights}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

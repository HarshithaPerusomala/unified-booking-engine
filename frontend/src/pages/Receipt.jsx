import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import styles from './Receipt.module.css';
import { API_BASE } from '../apiBase';

export default function Receipt() {
  const { bookingId } = useParams();
  const { getAuthHeader } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/receipt/${bookingId}`, { headers: getAuthHeader() })
      .then((r) => {
        if (!r.ok) throw new Error('Receipt not found');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [bookingId, getAuthHeader]);

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pageHeight - 20) {
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 10;
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight + 10;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
          heightLeft -= pageHeight - 20;
        }
      }

      pdf.save(`receipt-${bookingId}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading receipt…</div>;
  if (error) return <div className={styles.error}>Error: {error}. <Link to="/bookings">Back to bookings</Link></div>;

  const { booking, user } = data || {};
  const d = booking?.details || {};

  return (
    <div className={styles.page}>
      <div className={styles.actions}>
        <Link to="/bookings">← My Bookings</Link>
        <button type="button" className={styles.printBtn} onClick={handleDownloadPdf} disabled={downloading}>
          {downloading ? 'Downloading...' : 'Save PDF'}
        </button>
      </div>
      <div ref={receiptRef} className={styles.receipt}>
        <header className={styles.receiptHeader}>
          <h1>BookFlow</h1>
          <p>Payment Receipt</p>
        </header>
        <div className={styles.receiptMeta}>
          <div className={styles.row}>
            <span>Booking ID</span>
            <strong>{booking?.id}</strong>
          </div>
          <div className={styles.row}>
            <span>Payment ID</span>
            <strong>{booking?.paymentId}</strong>
          </div>
          <div className={styles.row}>
            <span>Date</span>
            <strong>{booking?.createdAt ? new Date(booking.createdAt).toLocaleString() : '—'}</strong>
          </div>
          <div className={styles.row}>
            <span>Customer</span>
            <strong>{user?.name || user?.email || '—'}</strong>
          </div>
          <div className={styles.row}>
            <span>Email</span>
            <strong>{user?.email || '—'}</strong>
          </div>
        </div>
        <section className={styles.section}>
          <h2>Booking details</h2>
          {booking?.type === 'movie' && (
            <ul>
              <li><strong>Movie</strong> {d.movie}</li>
              <li><strong>Genre</strong> {d.genre}</li>
              <li><strong>Date</strong> {d.date || '—'}</li>
              <li><strong>Showtime</strong> {d.showtime}</li>
              <li><strong>Seats</strong> {Array.isArray(d.seats) && d.seats.length ? d.seats.join(', ') : '—'}</li>
              <li><strong>Tickets</strong> {d.tickets}</li>
              {Array.isArray(d.seatPrices) && d.seatPrices.length > 0 ? (
                <li><strong>Seat pricing</strong> {d.seatPrices.map((s) => `${s.seat}: ₹${s.price}`).join(', ')}</li>
              ) : (
                <li><strong>Price per ticket</strong> ₹{d.pricePerTicket}</li>
              )}
            </ul>
          )}
          {booking?.type === 'hotel' && (
            <ul>
              <li><strong>Hotel</strong> {d.hotel}</li>
              <li><strong>City</strong> {d.city}</li>
              <li><strong>Nights</strong> {d.nights}</li>
              <li><strong>Price per night</strong> ₹{d.pricePerNight}</li>
              {d.amenities?.length > 0 && <li><strong>Amenities</strong> {d.amenities.join(', ')}</li>}
            </ul>
          )}
          {booking?.type === 'travel' && (
            <ul>
              <li><strong>Type</strong> {d.type}</li>
              <li><strong>Route</strong> {d.from} → {d.to}</li>
              <li><strong>Date</strong> {d.date}</li>
              <li><strong>Carrier</strong> {d.carrier}</li>
              {d.type === 'Flight' && (
                <>
                  <li><strong>Category</strong> {d.flightCategory || 'domestic'}</li>
                  <li><strong>Departure</strong> {d.departureLocalTime || '—'} ({d.departureTimezone || 'Local time'})</li>
                  <li><strong>Arrival</strong> {d.arrivalLocalTime || '—'} ({d.arrivalTimezone || 'Local time'})</li>
                </>
              )}
            </ul>
          )}
        </section>
        <div className={styles.total}>
          <span>Total paid</span>
          <strong>₹{booking?.totalAmount?.toFixed(2)}</strong>
        </div>
        <footer className={styles.receiptFooter}>
          <p>Thank you for booking with BookFlow.</p>
          <p>This is a computer-generated receipt and does not require a signature.</p>
        </footer>
      </div>
    </div>
  );
}

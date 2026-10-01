import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './Booking.module.css';
import { API_BASE } from '../apiBase';

export default function Travel() {
  const { getAuthHeader } = useAuth();
  const [travels, setTravels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState('list');
  const [travelType, setTravelType] = useState('Flight');
  const [selectedDate, setSelectedDate] = useState('');
  const [pricingSettings, setPricingSettings] = useState({ weekendMultiplier: 1.2, infantDiscountMultiplier: 0.5 });
  const [passenger, setPassenger] = useState({ fullName: '', age: '', phone: '', foodType: 'Veg', foodChoice: 'Paneer Curry' });
  const [withChildren, setWithChildren] = useState('no');
  const [children, setChildren] = useState([]);
  const [errors, setErrors] = useState({});
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [paying, setPaying] = useState(false);
  const [bookingId, setBookingId] = useState(null);

  useEffect(() => {
    Promise.all([fetch(`${API_BASE}/api/travels`), fetch(`${API_BASE}/api/settings/pricing`)])
      .then(async ([travelRes, settingsRes]) => {
        const travelData = await travelRes.json();
        setTravels(travelData);
        if (settingsRes.ok) setPricingSettings(await settingsRes.json());
      })
      .finally(() => setLoading(false));
  }, []);

  const handleBook = (t) => {
    setSelected(t);
    setSelectedDate(t.date || '');
    setStep('passenger');
    setSelectedSeats([]);
    setErrors({});
  };

  const vegOptions = ['Paneer Curry', 'Veg Biryani', 'Dal Rice', 'Chapati with Sabzi'];
  const nonVegOptions = ['Chicken Biryani', 'Egg Curry', 'Fish Fry', 'Chicken Curry with Rice'];
  const flightReservedSeats = ['R6-A', 'R6-D', 'R11-C', 'R14-F', 'R18-B'];
  const flightAccessibleSeats = ['R1-C', 'R1-D', 'R2-C', 'R2-D'];
  const busReservedSeats = ['B2-A', 'B4-D', 'B7-B', 'B8-C'];
  const busAccessibleSeats = ['B1-A', 'B1-B'];

  const isWeekend = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  const getSeatCategory = (seatCode) => {
    const row = seatCode.split('-')[0];
    if (selected?.type === 'Flight') {
      if (['R1', 'R2', 'R3', 'R4', 'R5'].includes(row)) return 'front';
      if (['R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14'].includes(row)) return 'middle';
      return 'last';
    }
    if (selected?.type === 'Bus') {
      if (['B1', 'B2', 'B3', 'B4'].includes(row)) return 'front';
      if (['B5', 'B6', 'B7', 'B8'].includes(row)) return 'middle';
      return 'last';
    }
    return 'middle';
  };

  const seatCategoryMultiplier = (category) => {
    if (category === 'front') return 1.15;
    if (category === 'last') return 0.9;
    return 1;
  };

  const baseFare = Number(selected?.price || 0);
  const weekendApplied = selectedDate ? isWeekend(selectedDate) : false;
  const dateAdjustedFare = weekendApplied ? baseFare * pricingSettings.weekendMultiplier : baseFare;
  const validChildren = children.filter((c) => c.name.trim() && Number(c.age) >= 0);
  const childTotal = validChildren.reduce((sum, child) => {
    const age = Number(child.age);
    const childFare = age <= 2 ? dateAdjustedFare * pricingSettings.infantDiscountMultiplier : dateAdjustedFare;
    return sum + childFare;
  }, 0);
  const travelersCount = 1 + (withChildren === 'yes' ? validChildren.length : 0);
  const minRequiredSeats = selected?.type === 'Flight' || selected?.type === 'Bus' ? travelersCount : 0;
  const seatSurchargeTotal = selectedSeats.reduce((sum, seat) => {
    const category = getSeatCategory(seat);
    return sum + (dateAdjustedFare * (seatCategoryMultiplier(category) - 1));
  }, 0);
  const totalFare = dateAdjustedFare + childTotal + seatSurchargeTotal;

  const validatePassengerForm = () => {
    const nextErrors = {};
    if (!passenger.fullName.trim()) nextErrors.fullName = 'Full name is required';
    if (!Number.isFinite(Number(passenger.age)) || Number(passenger.age) <= 0) nextErrors.age = 'Age must be a positive number';
    if (!/^\+?[0-9]{10,15}$/.test(passenger.phone.trim())) nextErrors.phone = 'Enter a valid phone number (10 to 15 digits)';
    if (!selectedDate) nextErrors.date = 'Travel date is required';
    if (selectedDate && new Date(selectedDate) < new Date(new Date().toDateString())) nextErrors.date = 'Past date booking is not allowed';
    if (withChildren === 'yes') {
      if (children.length === 0) nextErrors.children = 'Add at least one child or select No';
      children.forEach((child, index) => {
        if (!child.name.trim()) nextErrors[`childName_${index}`] = 'Child name is required';
        if (!Number.isFinite(Number(child.age)) || Number(child.age) < 0) nextErrors[`childAge_${index}`] = 'Enter valid child age';
      });
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const openSeatSelection = () => {
    if (!validatePassengerForm()) return;
    setStep((selected?.type === 'Flight' || selected?.type === 'Bus') ? 'seats' : 'confirm');
  };

  const isReservedSeat = (seatCode) => {
    if (selected?.type === 'Flight') return flightReservedSeats.includes(seatCode);
    if (selected?.type === 'Bus') return busReservedSeats.includes(seatCode);
    return false;
  };

  const isAccessibleSeat = (seatCode) => {
    if (selected?.type === 'Flight') return flightAccessibleSeats.includes(seatCode);
    if (selected?.type === 'Bus') return busAccessibleSeats.includes(seatCode);
    return false;
  };

  const seatClassName = (seatCode) => {
    if (selectedSeats.includes(seatCode)) return styles.seatSelected;
    if (isReservedSeat(seatCode)) return styles.seatReserved;
    if (isAccessibleSeat(seatCode)) return styles.seatAccessible;
    const category = getSeatCategory(seatCode);
    if (category === 'front') return styles.seatFront;
    if (category === 'last') return styles.seatLast;
    return styles.seatMiddle;
  };

  const toggleSeat = (seatCode) => {
    if (isReservedSeat(seatCode)) return;
    setSelectedSeats((prev) => (prev.includes(seatCode) ? prev.filter((s) => s !== seatCode) : [...prev, seatCode]));
  };

  const finalizeBooking = async () => {
    if (!selected) return;
    if ((selected?.type === 'Flight' || selected?.type === 'Bus') && selectedSeats.length < minRequiredSeats) {
      setErrors({ seats: `Please select at least ${minRequiredSeats} seat(s)` });
      return;
    }
    setPaying(true);
    try {
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          type: 'travel',
          details: {
            travelId: selected.id,
            type: selected.type,
            from: selected.from,
            to: selected.to,
            date: selectedDate,
            carrier: selected.carrier,
            baseFare,
            weekendMultiplier: pricingSettings.weekendMultiplier,
            weekendApplied,
            flightCategory: selected.flightCategory,
            departureLocalTime: selected.departureLocalTime,
            arrivalLocalTime: selected.arrivalLocalTime,
            departureTimezone: selected.departureTimezone,
            arrivalTimezone: selected.arrivalTimezone,
            passenger,
            children: withChildren === 'yes' ? validChildren : [],
            seats: selectedSeats,
            seatBreakdown: selectedSeats.map((s) => {
              const category = getSeatCategory(s);
              return { seat: s, category, fare: Number((dateAdjustedFare * seatCategoryMultiplier(category)).toFixed(2)) };
            }),
            foodType: passenger.foodType,
            foodChoice: passenger.foodChoice,
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

  if (loading) return <div className={styles.loading}>Loading travel options…</div>;

  if (step === 'done' && bookingId) {
    window.location.href = `/receipt/${bookingId}`;
    return <div className={styles.loading}>Redirecting to receipt…</div>;
  }

  if (step === 'passenger' && selected) {
    const foodOptions = passenger.foodType === 'Veg' ? vegOptions : nonVegOptions;
    return (
      <div className={styles.page}>
        <h1 className={styles.h1}>Passenger Details</h1>
        <div className={styles.summary}>
          <h2>{selected.type} - {selected.carrier}</h2>
          <p>{selected.from} to {selected.to}</p>
          <p>Base Fare: ₹{baseFare.toFixed(2)}</p>
          {weekendApplied && <p className={styles.weekendTag}>🔥 Weekend Pricing Applied (+{Math.round((pricingSettings.weekendMultiplier - 1) * 100)}%)</p>}
        </div>
        <div className={styles.summary}>
          <label>Full Name
            <input value={passenger.fullName} onChange={(e) => setPassenger({ ...passenger, fullName: e.target.value })} />
            {errors.fullName && <small className={styles.errorText}>{errors.fullName}</small>}
          </label>
          <label>Age
            <input type="number" min="1" value={passenger.age} onChange={(e) => setPassenger({ ...passenger, age: e.target.value })} />
            {errors.age && <small className={styles.errorText}>{errors.age}</small>}
          </label>
          <label>Phone Number
            <input value={passenger.phone} onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })} />
            {errors.phone && <small className={styles.errorText}>{errors.phone}</small>}
          </label>
          <label>Travel Date
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            {errors.date && <small className={styles.errorText}>{errors.date}</small>}
          </label>
          <label>Food Preference
            <select
              value={passenger.foodType}
              onChange={(e) => setPassenger({ ...passenger, foodType: e.target.value, foodChoice: e.target.value === 'Veg' ? vegOptions[0] : nonVegOptions[0] })}
            >
              <option value="Veg">Veg</option>
              <option value="Non-Veg">Non-Veg</option>
            </select>
          </label>
          <label>Food Option
            <select value={passenger.foodChoice} onChange={(e) => setPassenger({ ...passenger, foodChoice: e.target.value })}>
              {foodOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Are you traveling with children?
            <select value={withChildren} onChange={(e) => setWithChildren(e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          {withChildren === 'yes' && (
            <div className={styles.childrenBlock}>
              {errors.children && <small className={styles.errorText}>{errors.children}</small>}
              {children.map((child, index) => (
                <div key={`child-${index}`} className={styles.childRow}>
                  <input
                    placeholder="Child name"
                    value={child.name}
                    onChange={(e) => setChildren((prev) => prev.map((c, i) => i === index ? { ...c, name: e.target.value } : c))}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Child age"
                    value={child.age}
                    onChange={(e) => setChildren((prev) => prev.map((c, i) => i === index ? { ...c, age: e.target.value } : c))}
                  />
                </div>
              ))}
              {children.map((_, index) => (
                <div key={`child-errors-${index}`}>
                  {errors[`childName_${index}`] && <small className={styles.errorText}>{errors[`childName_${index}`]}</small>}
                  {errors[`childAge_${index}`] && <small className={styles.errorText}>{errors[`childAge_${index}`]}</small>}
                </div>
              ))}
              <button type="button" className={styles.secondary} onClick={() => setChildren((prev) => [...prev, { name: '', age: '' }])}>+ Add Child</button>
            </div>
          )}
        </div>
        <div className={styles.summary}>
          <p>Base Fare: ₹{baseFare.toFixed(2)}</p>
          <p>Weekend Charges: ₹{(dateAdjustedFare - baseFare).toFixed(2)}</p>
          <p>Child Discount: ₹{(withChildren === 'yes' ? validChildren.reduce((sum, child) => {
            const age = Number(child.age);
            if (age <= 2) return sum + (dateAdjustedFare - dateAdjustedFare * pricingSettings.infantDiscountMultiplier);
            return sum;
          }, 0) : 0).toFixed(2)}</p>
          <p><strong>Current Total: ₹{totalFare.toFixed(2)}</strong></p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => setStep('list')}>Back</button>
          <button type="button" className={styles.primary} onClick={openSeatSelection}>
            {selected.type === 'Flight' || selected.type === 'Bus' ? 'Continue to Seat Selection' : 'Continue to Confirm'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'seats' && selected) {
    const renderFlightSeats = () => {
      const rows = Array.from({ length: 20 }, (_, i) => i + 1);
      return (
        <div className={styles.flightLayout}>
          <div className={styles.mapHeader}>✈ Seat(s) selection</div>
          {rows.map((r) => (
            <div key={`row-${r}`} className={styles.flightRow}>
              <span className={styles.rowNumber}>{r}</span>
              {['A', 'B', 'C', 'D', 'E', 'F'].map((col, idx) => {
                const seatCode = `R${r}-${col}`;
                return (
                  <button
                    key={seatCode}
                    type="button"
                    className={seatClassName(seatCode)}
                    onClick={() => toggleSeat(seatCode)}
                    style={idx === 2 ? { marginRight: '0.7rem' } : undefined}
                    disabled={isReservedSeat(seatCode)}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      );
    };

    const renderBusSeats = () => {
      const rows = Array.from({ length: 10 }, (_, i) => i + 1);
      return (
        <div className={styles.busLayout}>
          <div className={styles.mapHeader}>🚌 Seat(s) selection</div>
          {rows.map((r) => (
            <div key={`bus-row-${r}`} className={styles.flightRow}>
              <span className={styles.rowNumber}>{r}</span>
              {['A', 'B', 'C', 'D'].map((col, idx) => {
                const seatCode = `B${r}-${col}`;
                return (
                  <button
                    key={seatCode}
                    type="button"
                    className={seatClassName(seatCode)}
                    onClick={() => toggleSeat(seatCode)}
                    style={idx === 1 ? { marginRight: '1rem' } : undefined}
                    disabled={isReservedSeat(seatCode)}
                  >
                    {seatCode.split('-')[1]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className={styles.page}>
        <h1 className={styles.h1}>Seat Selection</h1>
        <p className={styles.lead}>Select at least {minRequiredSeats} seat(s). Front/Middle/Last seats have different fares.</p>
        <div className={styles.summary}>
          <p>Front seat fare: ₹{(dateAdjustedFare * seatCategoryMultiplier('front')).toFixed(2)}</p>
          <p>Middle seat fare: ₹{(dateAdjustedFare * seatCategoryMultiplier('middle')).toFixed(2)}</p>
          <p>Last seat fare: ₹{(dateAdjustedFare * seatCategoryMultiplier('last')).toFixed(2)}</p>
          <p>Selected Seats: {selectedSeats.length ? selectedSeats.join(', ') : 'None'}</p>
          {errors.seats && <small className={styles.errorText}>{errors.seats}</small>}
        </div>
        <div className={styles.seatLegend}>
          <span><i className={`${styles.legendDot} ${styles.legendSelected}`}></i> Selected</span>
          <span><i className={`${styles.legendDot} ${styles.legendMiddle}`}></i> Standard</span>
          <span><i className={`${styles.legendDot} ${styles.legendFront}`}></i> Front</span>
          <span><i className={`${styles.legendDot} ${styles.legendLast}`}></i> Last</span>
          <span><i className={`${styles.legendDot} ${styles.legendReserved}`}></i> Reserved</span>
          <span><i className={`${styles.legendDot} ${styles.legendAccessible}`}></i> Accessible</span>
        </div>
        {selected.type === 'Flight' ? renderFlightSeats() : renderBusSeats()}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => setStep('passenger')}>Back</button>
          <button type="button" className={styles.primary} onClick={() => setStep('confirm')} disabled={selectedSeats.length < minRequiredSeats}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (step === 'confirm' && selected) {
    return (
      <div className={styles.page}>
        <h1 className={styles.h1}>Confirm & Pay</h1>
        <div className={styles.summary}>
          <h2>{selected.type} - {selected.carrier}</h2>
          <p>{selected.from} to {selected.to}</p>
          <p>Date: {selectedDate}</p>
          {selected.type === 'Flight' && (
            <>
              <p>Departure: {selected.departureLocalTime} ({selected.departureTimezone})</p>
              <p>Arrival: {selected.arrivalLocalTime} ({selected.arrivalTimezone})</p>
              <p>Category: {selected.flightCategory === 'international' ? 'International' : 'Domestic'}</p>
            </>
          )}
          <p>Main Passenger: {passenger.fullName} ({passenger.age})</p>
          <p>Food: {passenger.foodType} - {passenger.foodChoice}</p>
          {withChildren === 'yes' && <p>Children: {validChildren.map((c) => `${c.name} (${c.age})`).join(', ') || 'None'}</p>}
          {(selected.type === 'Flight' || selected.type === 'Bus') && <p>Seats: {selectedSeats.join(', ')}</p>}
          <p>Base Fare: ₹{baseFare.toFixed(2)}</p>
          <p>Weekend Charges: ₹{(dateAdjustedFare - baseFare).toFixed(2)}</p>
          <p>Seat Surcharge: ₹{seatSurchargeTotal.toFixed(2)}</p>
          <p><strong>Final Total: ₹{totalFare.toFixed(2)}</strong></p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => setStep(selected.type === 'Flight' || selected.type === 'Bus' ? 'seats' : 'passenger')}>Back</button>
          <button type="button" className={styles.primary} onClick={finalizeBooking} disabled={paying}>
            {paying ? 'Processing...' : `Pay ₹${totalFare.toFixed(2)}`}
          </button>
        </div>
      </div>
    );
  }

  const domesticFlights = travels.filter((t) => t.type === 'Flight' && t.flightCategory === 'domestic');
  const internationalFlights = travels.filter((t) => t.type === 'Flight' && t.flightCategory === 'international');
  const trains = travels.filter((t) => t.type === 'Train');
  const buses = travels.filter((t) => t.type === 'Bus');

  const renderTravelCards = (items) => (
    <div className={styles.grid}>
      {items.map((t) => (
        <div key={t.id} className={styles.card}>
          <h3>{t.type}</h3>
          <p className={styles.meta}>{t.carrier}</p>
          <p className={styles.route}>{t.from} to {t.to}</p>
          <p className={styles.meta}>Date: {t.date}</p>
          {t.type === 'Flight' && (
            <>
              <p className={styles.meta}>Departure: {t.departureLocalTime} ({t.departureTimezone})</p>
              <p className={styles.meta}>Arrival: {t.arrivalLocalTime} ({t.arrivalTimezone})</p>
            </>
          )}
          <p className={styles.price}>₹{t.price}</p>
          <button type="button" className={styles.primary} onClick={() => handleBook(t)}>
            Book now
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Book travel</h1>
      <p className={styles.lead}>Choose booking option. Flight contains domestic and international sections.</p>
      <div className={styles.tabs}>
        {['Flight', 'Train', 'Bus'].map((type) => (
          <button
            key={type}
            type="button"
            className={travelType === type ? styles.tabActive : styles.tab}
            onClick={() => setTravelType(type)}
          >
            {type}
          </button>
        ))}
      </div>

      {travelType === 'Flight' && (
        <>
          <h2 className={styles.sectionTitle}>Domestic Flights</h2>
          {renderTravelCards(domesticFlights)}
          <h2 className={styles.sectionTitle}>International Flights</h2>
          {renderTravelCards(internationalFlights)}
        </>
      )}
      {travelType === 'Train' && renderTravelCards(trains)}
      {travelType === 'Bus' && renderTravelCards(buses)}
    </div>
  );
}

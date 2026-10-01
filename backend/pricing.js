// Server-side price calculation. The client sends *what* it wants to book
// (ids, seats, nights...) and the server works out *how much* it costs, so a
// tampered request can never change the price.

export class BookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

// ---- Movies ----
const MOVIE_ROWS = { A: 14, B: 14, C: 14, D: 11, E: 13, F: 13, G: 13, H: 13, I: 17 };

function movieSeatZone(row) {
  if ('ABC'.includes(row)) return 'front';
  if ('DEF'.includes(row)) return 'middle';
  return 'last';
}

export function priceMovieBooking(movie, { date, showtime, seats }) {
  if (!Array.isArray(seats) || seats.length === 0) throw new BookingError('Select at least one seat');
  if (seats.length > 10) throw new BookingError('You can book at most 10 seats at a time');
  if (new Set(seats).size !== seats.length) throw new BookingError('Duplicate seats in request');

  const validShowtimes = movie.showtimesByDate ? movie.showtimesByDate[date] : movie.showtimes;
  if (!validShowtimes) throw new BookingError('Movie is not showing on that date');
  if (!validShowtimes.includes(showtime)) throw new BookingError('Invalid showtime');

  const seatPrices = seats.map((seat) => {
    const m = /^([A-I])(\d{1,2})$/.exec(String(seat));
    if (!m || Number(m[2]) < 1 || Number(m[2]) > MOVIE_ROWS[m[1]]) throw new BookingError(`Invalid seat: ${seat}`);
    const zone = movieSeatZone(m[1]);
    const price =
      zone === 'front' ? Math.max(1, movie.price - 2) : zone === 'last' ? movie.price + 3 : movie.price;
    return { seat, price, zone };
  });
  return { seatPrices, total: round2(seatPrices.reduce((s, x) => s + x.price, 0)) };
}

// ---- Hotels ----
export function priceHotelBooking(hotel, { nights }) {
  const n = Number(nights);
  if (!Number.isInteger(n) || n < 1 || n > 30) throw new BookingError('Nights must be a whole number from 1 to 30');
  return { nights: n, total: round2(hotel.pricePerNight * n) };
}

// ---- Travel ----
function travelSeatMultiplier(type, seat) {
  const row = String(seat).split('-')[0];
  let category = 'middle';
  if (type === 'Flight') {
    const r = Number(row.replace('R', ''));
    category = r >= 1 && r <= 5 ? 'front' : r >= 6 && r <= 14 ? 'middle' : 'last';
  } else if (type === 'Bus') {
    const r = Number(row.replace('B', ''));
    category = r >= 1 && r <= 4 ? 'front' : r >= 5 && r <= 8 ? 'middle' : 'last';
  }
  return category === 'front' ? 1.15 : category === 'last' ? 0.9 : 1;
}

export function isWeekend(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new BookingError('Invalid travel date');
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export function priceTravelBooking(travel, { date, children = [], seats = [] }, pricing) {
  const today = new Date().toISOString().slice(0, 10);
  if (!date || date < today) throw new BookingError('Travel date cannot be in the past');
  if (!Array.isArray(children) || !Array.isArray(seats)) throw new BookingError('Invalid passengers or seats');

  const weekendApplied = isWeekend(date);
  const fare = weekendApplied ? travel.price * pricing.weekendMultiplier : travel.price;

  const childTotal = children.reduce((sum, c) => {
    const age = Number(c?.age);
    if (!Number.isFinite(age) || age < 0) throw new BookingError('Invalid child age');
    return sum + (age <= 2 ? fare * pricing.infantDiscountMultiplier : fare);
  }, 0);

  const seatSurcharge = seats.reduce((sum, s) => sum + fare * (travelSeatMultiplier(travel.type, s) - 1), 0);
  return { weekendApplied, total: round2(fare + childTotal + seatSurcharge) };
}

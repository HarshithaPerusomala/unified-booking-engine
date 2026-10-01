import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo}>BookFlow</NavLink>
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}>Home</NavLink>
          <NavLink to="/movies" className={({ isActive }) => isActive ? styles.active : ''}>Movies</NavLink>
          <NavLink to="/hotels" className={({ isActive }) => isActive ? styles.active : ''}>Hotels</NavLink>
          <NavLink to="/travel" className={({ isActive }) => isActive ? styles.active : ''}>Travel</NavLink>
          <NavLink to="/bookings" className={({ isActive }) => isActive ? styles.active : ''}>My Bookings</NavLink>
          {user?.isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? styles.active : ''}>Admin</NavLink>
          )}
        </nav>
        <div className={styles.user}>
          <span className={styles.userName}>{user?.name || user?.email}</span>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

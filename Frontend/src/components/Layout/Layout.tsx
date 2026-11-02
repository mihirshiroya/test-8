import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';

const Layout: React.FC = () => {
  const location = useLocation();

  const showHeader = location.pathname === '/';

  return (
    <div className="min-h-screen">
      {showHeader && <Header />}

      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
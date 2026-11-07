import React from 'react';
import '../../App.css';

function StaleDataBanner({ message }: { message: string }) {
  return <div className="stale-data-banner">{message}</div>;
}

export default StaleDataBanner;

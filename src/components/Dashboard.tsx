// @ts-nocheck
import React, { useEffect, useState } from 'react';
import '../App.css';

const Dashboard = ({ activeTab }) => {
  const [prophetEvents, setProphetEvents] = useState([]);
  const [kalshiEvents, setKalshiEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [prophetError, setProphetError] = useState(null);
  const [kalshiError, setKalshiError] = useState(null);
  const [loadingProphet, setLoadingProphet] = useState(true);
  const [loadingKalshi, setLoadingKalshi] = useState(true);

  const [eventIdInput, setEventIdInput] = useState('');
  const [eventMarkets, setEventMarkets] = useState([]);
  const [eventMarketError, setEventMarketError] = useState(null);

  const [kalshiEventId, setKalshiEventId] = useState('');
  const [kalshiEventMarkets, setKalshiEventMarkets] = useState([]);
  const [kalshiEventMarketError, setKalshiEventMarketError] = useState(null);

  useEffect(() => {
    const fetchProphetEvents = async () => {
      try {
        setLoadingProphet(true);
        const response = await fetch('https://us-central1-egg-models.cloudfunctions.net/getEvents');
        if (!response.ok) throw new Error('ProphetX fetch failed');
        const data = await response.json();
        setProphetEvents(data.data?.sport_events || []);
      } catch (err) {
        setProphetError('Failed to load ProphetX events.');
      } finally {
        setLoadingProphet(false);
      }
    };

    const fetchKalshiEvents = async () => {
      try {
        setLoadingKalshi(true);
        const response = await fetch('https://us-central1-egg-models.cloudfunctions.net/getKalshiEvents');
        if (!response.ok) throw new Error('Kalshi fetch failed');
        const data = await response.json();
        setKalshiEvents(Array.isArray(data) ? data : data.events || []);
      } catch (err) {
        setKalshiError('Failed to load Kalshi events.');
      } finally {
        setLoadingKalshi(false);
      }
    };

    fetchProphetEvents();
    fetchKalshiEvents();
  }, []);

  const filteredProphet = prophetEvents.filter(event =>
    event.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredKalshi = kalshiEvents.filter(event =>
    event.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFetchMarkets = async () => {
    setEventMarketError(null);
    setEventMarkets([]);
    if (!eventIdInput) return;
    try {
      const res = await fetch(`https://us-central1-egg-models.cloudfunctions.net/getProphetMarkets?event_id=${eventIdInput}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setEventMarkets(data.data?.markets || []);
    } catch (err) {
      setEventMarketError('Failed to load markets for this event ID.');
    }
  };

  const handleFetchKalshiMarkets = async () => {
    setKalshiEventMarketError(null);
    setKalshiEventMarkets([]);
    if (!kalshiEventId) return;
    try {
      const res = await fetch(`https://us-central1-egg-models.cloudfunctions.net/getKalshiMarketsByEvent?event_id=${kalshiEventId}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setKalshiEventMarkets(data.markets || []);
    } catch (err) {
      setKalshiEventMarketError('Failed to load Kalshi markets for this event.');
    }
  };

  return (
    <div className="dashboard" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <div style={{ flex: 1, minWidth: '400px' }}>
          <h3>ProphetX Markets</h3>
          <input
            type="text"
            placeholder="Enter ProphetX event ID"
            value={eventIdInput}
            onChange={(e) => setEventIdInput(e.target.value)}
            style={{ padding: '8px', width: '200px', marginRight: '8px' }}
          />
          <button onClick={handleFetchMarkets}>Search</button>
          {eventMarketError && <p style={{ color: 'red' }}>{eventMarketError}</p>}
          {eventMarkets.length > 0 && (
            <div>
              <h4>Markets for Event ID {eventIdInput}:</h4>
              {eventMarkets
                .filter((market) => market.sub_type?.toLowerCase() === 'moneyline')
                .map((market, i) => (
                  <div key={i} style={{ marginBottom: '16px' }}>
                    <strong>{market.name}</strong><br />
                    <span>{market.category_name} — {market.sub_type}</span>
                    {market.selections && Array.isArray(market.selections) && market.selections.length > 0 && (
                      <ul>
                        {market.selections.flat().map((selection, idx) => (
                          <li key={idx}>
                            {selection.name || selection.display_name} — <strong>{selection.display_odds || 'N/A'}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                    <hr />
                  </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: '400px' }}>
          <h3>Kalshi Markets</h3>
          <input
            type="text"
            placeholder="Enter Kalshi event_ticker"
            value={kalshiEventId}
            onChange={(e) => setKalshiEventId(e.target.value)}
            style={{ padding: '8px', width: '200px', marginRight: '8px' }}
          />
          <button onClick={handleFetchKalshiMarkets}>Search</button>
          {kalshiEventMarketError && <p style={{ color: 'red' }}>{kalshiEventMarketError}</p>}
          {kalshiEventMarkets.length > 0 && (
            <div>
              <h4>Markets for Kalshi Event {kalshiEventId}:</h4>
              <ul>
                {kalshiEventMarkets.map((market, idx) => (
                  <li key={market.ticker || idx}>
                    <strong>{market.title}</strong><br />
                    <span><strong>Ticker:</strong> {market.ticker}</span><br />
                    <span><strong>Yes = </strong>{market.yes_sub_title || 'N/A'} — <strong>Bid / Ask:</strong> {market.yes_bid} / {market.yes_ask}</span><br />
                    <span><strong>No = </strong>{market.no_sub_title || 'N/A'} — <strong>Bid / Ask:</strong> {market.no_bid} / {market.no_ask}</span><br />
                    <span><strong>Last Price:</strong> {market.last_price}</span><br />
                    <span><strong>Volume 24h:</strong> {market.volume_24h}</span><br />
                    <span><strong>Close Time:</strong> {new Date(market.close_time).toLocaleString()}</span>
                    <hr />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <input
        type="text"
        placeholder="Search all events..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ padding: '8px', width: '100%', marginBottom: '24px' }}
      />
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h3>ProphetX Sports Events</h3>
          {loadingProphet ? (
            <p>Loading ProphetX events...</p>
          ) : prophetError ? (
            <p style={{ color: 'red' }}>{prophetError}</p>
          ) : filteredProphet.length === 0 ? (
            <p>No ProphetX events found.</p>
          ) : (
            <ul>
              {filteredProphet.map((event) => (
                <li key={event.event_id}>
                  <strong>{event.name || "Unnamed Match"}</strong><br />
                  <span>{new Date(event.scheduled).toLocaleString()}</span><br />
                  <span>Sport: {event.sport_name}</span><br />
                  <span>Event ID: {event.event_id}</span>
                  <hr />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          <h3>Kalshi Events</h3>
          {loadingKalshi ? (
            <p>Loading Kalshi events...</p>
          ) : kalshiError ? (
            <p style={{ color: 'red' }}>{kalshiError}</p>
          ) : filteredKalshi.length === 0 ? (
            <p>No Kalshi events found.</p>
          ) : (
            <ul>
              {filteredKalshi.map((market, idx) => (
                <li key={market.ticker || idx}>
                  <strong>{market.title}</strong><br />
                  <span>Ticker: {market.event_ticker}</span><br />
                  <hr />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import { useState } from 'react';
import './AutoPlanner.css';
import solverRules from './solver_rules.json';

export default function AutoPlanner({ requests, setRequests, onGenerate, isSolving, blockMode, setBlockMode }: any) {
  const [selectedCrop, setSelectedCrop] = useState('');
  const [maxMode, setMaxMode] = useState(false);
  
  // Filter out base crops for target selection (we usually just want to select mutations to solve for)
  const availableMutations = Object.keys(solverRules).filter(k => (solverRules as any)[k].type !== 'base');

  const handleAddRequest = () => {
    if (!selectedCrop) return;
    
    // Check if already requested
    if (requests.some((r: any) => r.name === selectedCrop)) return;

    setRequests([...requests, { 
      name: selectedCrop, 
      max: maxMode 
    }]);
    
    setSelectedCrop('');
    setMaxMode(false);
  };

  const removeRequest = (name: string) => {
    setRequests(requests.filter((r: any) => r.name !== name));
  };

  return (
    <div className="auto-planner animate-fade-in">
      <div className="planner-tabs">
        <button className="tab">GRID MANAGER</button>
        <button className="tab active">AUTO-PLANNER</button>
      </div>

      <div className="planner-content">
        
        <div className="card">
          <h3>ADD MUTATION REQUEST</h3>
          
          <div className="form-group">
            <label>Select crop...</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                className="select-field"
                value={selectedCrop}
                onChange={e => setSelectedCrop(e.target.value)}
              >
                <option value="">-- Choose Mutation --</option>
                {availableMutations.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="toggle-container" onClick={() => setMaxMode(!maxMode)}>
            <div className={`toggle-switch ${maxMode ? 'active' : ''}`}>
              <div className="toggle-knob"></div>
            </div>
            <span style={{ fontSize: '0.85rem', color: maxMode ? 'var(--accent-primary)' : 'var(--text-secondary)'}}>
              MAX Quantity
            </span>
          </div>

          <button 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            onClick={handleAddRequest}
            disabled={!selectedCrop}
          >
            ADD TO REQUESTS
          </button>
        </div>

        <div className="card">
          <h3>CURRENT REQUESTS</h3>
          {requests.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
              No requests added. Add crops to generate a layout.
            </p>
          ) : (
            <div className="requests-list">
              {requests.map((r: any) => (
                <div key={r.name} className="request-item">
                  <div className="request-info">
                    <span className="request-name">{r.name}</span>
                    <span className="request-qty">{r.max ? 'MAX Quantity' : '1 Quantity'}</span>
                  </div>
                  <button className="btn-remove" onClick={() => removeRequest(r.name)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>GRID CONTROLS</h3>
          <div className="toggle-container" onClick={() => setBlockMode(!blockMode)}>
            <div className={`toggle-switch ${blockMode ? 'active' : ''}`}>
              <div className="toggle-knob"></div>
            </div>
            <span style={{ fontSize: '0.85rem', color: blockMode ? 'var(--danger)' : 'var(--text-secondary)'}}>
              Block Slots Mode
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            When enabled, clicking the grid will mark slots as blocked (obstacles).
          </p>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1rem' }}
            onClick={onGenerate}
            disabled={isSolving || requests.length === 0}
          >
            {isSolving ? 'SOLVING...' : 'GENERATE LAYOUT'}
          </button>
        </div>

        <div className="max-feature">
          <h4>💡 MAX FEATURE</h4>
          <p>Toggle the MAX switch to automatically calculate the highest possible quantity for that crop to fit in your current grid.</p>
        </div>

      </div>
    </div>
  );
}

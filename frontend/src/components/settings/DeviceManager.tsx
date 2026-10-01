import React, { useState, useEffect } from "react";
import { api } from "@/services/apiClient";

interface DeviceItem {
  device_id: string;
  public_key: string;
  nickname: string;
  last_seen: string;
  revoked: boolean;
}

export const DeviceManager: React.FC = () => {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [pairingMode, setPairingMode] = useState(false);
  const [newDevice, setNewDevice] = useState({ nickname: "", device_id: "", public_key: "", pin: "" });
  const [loading, setLoading] = useState(false);

  const fetchDevices = async () => {
    try {
      const data = await api<DeviceItem[]>("/api/devices");
      setDevices(data);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/pair", {
        method: "POST",
        body: newDevice,
      });
      setPairingMode(false);
      setNewDevice({ nickname: "", device_id: "", public_key: "", pin: "" });
      await fetchDevices();
    } catch (err) {
      alert("Pairing failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!confirm("Are you sure you want to revoke this device?")) return;
    try {
      await api(`/api/revoke/${deviceId}`, { method: "POST" });
      await fetchDevices();
    } catch (err) {
      alert("Revocation failed");
    }
  };

  return (
    <div className="device-manager">
      <div className="section-header">
        <h2>Trusted Devices</h2>
        <button onClick={() => setPairingMode(!pairingMode)}>
          {pairingMode ? "Cancel" : "Pair New Device"}
        </button>
      </div>

      {pairingMode && (
        <form onSubmit={handlePair} className="pairing-form">
          <input
            placeholder="Nickname"
            value={newDevice.nickname}
            onChange={e => setNewDevice({...newDevice, nickname: e.target.value})}
            required
          />
          <input
            placeholder="Device ID"
            value={newDevice.device_id}
            onChange={e => setNewDevice({...newDevice, device_id: e.target.value})}
            required
          />
          <input
            placeholder="Public Key"
            value={newDevice.public_key}
            onChange={e => setNewDevice({...newDevice, public_key: e.target.value})}
            required
          />
          <input
            placeholder="PIN"
            type="password"
            value={newDevice.pin}
            onChange={e => setNewDevice({...newDevice, pin: e.target.value})}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Pairing..." : "Confirm Pairing"}
          </button>
        </form>
      )}

      <div className="device-list">
        {devices.length === 0 ? (
          <p className="empty-state">No trusted devices found.</p>
        ) : (
          devices.map(device => (
            <div key={device.device_id} className={`device-item ${device.revoked ? 'revoked' : ''}`}>
              <div className="device-info">
                <strong>{device.nickname}</strong>
                <span className="device-id">{device.device_id}</span>
                <span className="last-seen">Last seen: {new Date(device.last_seen).toLocaleString()}</span>
              </div>
              {!device.revoked && (
                <button onClick={() => handleRevoke(device.device_id)} className="revoke-btn">
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .device-manager { padding: 20px; color: var(--text-primary); }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .pairing-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 8px; }
        .pairing-form input { padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); }
        .device-list { display: flex; flex-direction: column; gap: 10px; }
        .device-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); }
        .device-item.revoked { opacity: 0.6; border-style: dashed; }
        .device-info { display: flex; flex-direction: column; gap: 4px; }
        .device-id { font-family: monospace; font-size: 0.8rem; color: var(--text-secondary); }
        .last-seen { font-size: 0.75rem; color: var(--text-tertiary); }
        .revoke-btn { padding: 6px 12px; background: var(--error-color, #ef4444); color: white; border: none; border-radius: 4px; cursor: pointer; }
        .empty-state { text-align: center; color: var(--text-secondary); margin-top: 20px; }
      `}</style>
    </div>
  );
};

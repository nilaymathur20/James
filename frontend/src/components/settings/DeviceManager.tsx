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
  const [newDevice, setNewDevice] = useState({ nickname: "", device_id: "", public_key: "", pin: "", address: "" });
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
      await api("/api/devices/pair", {
        method: "POST",
        body: newDevice,
      });
      setPairingMode(false);
      setNewDevice({ nickname: "", device_id: "", public_key: "", pin: "", address: "" });
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
      await api(`/api/devices/revoke/${deviceId}`, { method: "POST" });
      await fetchDevices();
    } catch (err) {
      alert("Revocation failed");
    }
  };

  return (
    <div className="device-manager">
      <div className="section-header">
        <h2>Trusted Devices</h2>
        <button type="button" onClick={() => setPairingMode(!pairingMode)}>
          {pairingMode ? "Cancel" : "Pair New Device"}
        </button>
      </div>

      {pairingMode && (
        <form onSubmit={handlePair} className="pairing-form">
          <input
            placeholder="Nickname"
            value={newDevice.nickname}
            onChange={(e) => setNewDevice({ ...newDevice, nickname: e.target.value })}
            required
          />
          <input
            placeholder="Device ID"
            value={newDevice.device_id}
            onChange={(e) => setNewDevice({ ...newDevice, device_id: e.target.value })}
            required
          />
          <input
            placeholder="Public Key"
            value={newDevice.public_key}
            onChange={(e) => setNewDevice({ ...newDevice, public_key: e.target.value })}
            required
          />
          <input
            placeholder="PIN (from pair/challenge)"
            type="password"
            value={newDevice.pin}
            onChange={(e) => setNewDevice({ ...newDevice, pin: e.target.value })}
            required
          />
          <input
            placeholder="Peer address (e.g. http://192.168.1.100:8000)"
            value={newDevice.address}
            onChange={(e) => setNewDevice({ ...newDevice, address: e.target.value })}
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
          devices.map((device) => (
            <div key={device.device_id} className={`device-item ${device.revoked ? "revoked" : ""}`}>
              <div className="device-info">
                <strong>{device.nickname}</strong>
                <span className="device-id">{device.device_id}</span>
                <span className="last-seen">Last seen: {new Date(device.last_seen).toLocaleString()}</span>
              </div>
              {!device.revoked && (
                <button type="button" onClick={() => handleRevoke(device.device_id)} className="revoke-btn">
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

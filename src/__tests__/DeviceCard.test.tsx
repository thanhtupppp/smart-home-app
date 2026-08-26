import React from 'react';
import renderer from 'react-test-renderer';
import { DeviceCard } from '../components/DeviceCard';
import { Device } from '../types';

describe('DeviceCard Component Tests', () => {
  const mockDevice: Device = {
    id: 'dev_light_living',
    name: 'Đèn chùm phòng khách',
    type: 'light',
    roomId: 'room_living',
    roomName: 'Phòng khách',
    isOnline: true,
    isOn: true,
    powerUsageWatts: 45,
  };

  it('renders device information correctly', () => {
    const onToggle = jest.fn();
    let tree: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(<DeviceCard device={mockDevice} onToggle={onToggle} />);
    });

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Đèn chùm phòng khách');
    expect(json).toContain('Phòng khách');
    expect(json).toContain('45');
    expect(json).toContain('W');
  });

  it('renders correctly when device is turned off', () => {
    const onToggle = jest.fn();
    const offDevice: Device = { ...mockDevice, isOn: false };
    let tree: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(<DeviceCard device={offDevice} onToggle={onToggle} />);
    });

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Đã tắt');
  });
});

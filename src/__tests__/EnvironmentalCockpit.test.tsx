import React from 'react';
import renderer from 'react-test-renderer';
import { EnvironmentalCockpit } from '../components/EnvironmentalCockpit';
import { HomeOverview } from '../types';

describe('EnvironmentalCockpit Component Tests', () => {
  const mockOverview: HomeOverview = {
    homeName: 'Biệt Thự Smart Home',
    totalDevices: 8,
    onlineDevices: 8,
    activeDevices: 3,
    avgTemperature: 26.5,
    avgHumidity: 58,
    powerConsumptionWatts: 420,
    securityStatus: 'armed',
  };

  it('renders correctly with environment metrics', () => {
    let tree: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(<EnvironmentalCockpit overview={mockOverview} />);
    });

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Môi trường trong nhà');
    expect(json).toContain('26.5');
    expect(json).toContain('58');
    expect(json).toContain('420');
    expect(json).toContain('Trực tiếp');
  });
});

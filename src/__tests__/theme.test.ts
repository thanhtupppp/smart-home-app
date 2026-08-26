import { NeuPalette, NeuStyles } from '../theme/neumorphism';
import { Colors } from '../theme/colors';

describe('Neumorphism Design System Tests', () => {
  it('should have consistent base background color #E8ECF2', () => {
    expect(NeuPalette.bg).toBe('#E8ECF2');
    expect(Colors.background).toBe('#E8ECF2');
  });

  it('should define dual shadow colors (highlight and dark shadow)', () => {
    expect(NeuPalette.shadowLight).toBe('#FFFFFF');
    expect(NeuPalette.shadowDark).toBe('#B8C4D4');
  });

  it('should have properly structured raised and cavity styles', () => {
    expect(NeuStyles.raised).toBeDefined();
    expect(NeuStyles.cavity).toBeDefined();
    expect(NeuStyles.pressed).toBeDefined();
    expect(NeuStyles.circleRaised).toBeDefined();
  });

  it('should have LED glow accent colors', () => {
    expect(NeuPalette.accentBlue).toBe('#3B82F6');
    expect(NeuPalette.accentGreen).toBe('#10B981');
    expect(NeuPalette.accentAmber).toBe('#F59E0B');
  });
});

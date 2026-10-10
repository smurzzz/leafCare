/**
 * Unit conversions. Metric is the storage default (`amount_ml`); Imperial is a
 * pure presentation concern per docs/specification.md screen 22.
 */

export type UnitSystem = 'metric' | 'imperial';

const ML_PER_OZ = 29.5735295625;

export const mlToOz = (ml: number): number => ml / ML_PER_OZ;

export const ozToMl = (oz: number): number => Math.round(oz * ML_PER_OZ);

/** `250 ml` / `8.5 oz` */
export const formatVolume = (amountMl: number, units: UnitSystem): string => {
  if (units === 'imperial') {
    const oz = mlToOz(amountMl);
    const rounded = Math.round(oz * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} oz`;
  }
  return `${Math.round(amountMl)} ml`;
};

/** Care-log summary sentence volume, e.g. `12 waterings this month`. */
export const formatCelsius = (celsius: number, units: UnitSystem): string => {
  if (units === 'imperial') {
    const fahrenheit = Math.round((celsius * 9) / 5 + 32);
    return `${fahrenheit}°F`;
  }
  return `${Math.round(celsius)}°C`;
};

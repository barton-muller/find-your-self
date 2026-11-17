import { iconPath, rainDrops } from '../icons';
import { rainLevel, type Wx } from '../dayWeather';

export function WxBody({ w }: { w: Wx }) {
  return (
    <>
      <path d={iconPath(w.kind === 'rain' ? 'rain' : w.kind === 'cloud' ? 'cloud' : 'sun')} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {w.kind === 'rain' && <path d={rainDrops[rainLevel(w.mm)]} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />}
    </>
  );
}

export function WxIcon({ w, size = 22 }: { w: Wx; size?: number }) {
  return (
    <svg className={`wx wx-${w.kind}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><WxBody w={w} /></svg>
  );
}

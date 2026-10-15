import type { StatusServera } from '@/lib/status';
import { SITE } from '@/config/site';

// Tabla na ulazu u grad, sa brojem ljudi u gradu uživo
export function GradskaTabla({ status }: { status: StatusServera }) {
  const { online, igraca, max } = status;
  return (
    <div className="relative mx-auto w-full max-w-[340px] pb-[46px]" role="status" aria-live="polite">
      <div className={`tabla ${online ? '' : 'ugasena'}`}>
        <div className="tabla-unutra text-center">
          <p className="font-display text-[22px] font-bold leading-tight tracking-tight">{SITE.grad}</p>
          <div className="mx-auto my-3 h-[2.5px] w-16 rounded-full bg-white/90" />
          {online ? (
            <>
              <p className="text-[14px] font-medium text-white/90">Trenutno u gradu</p>
              <p className="mt-1 font-display text-[64px] font-extrabold leading-none tabular-nums">{igraca}</p>
              {max > 0 && <p className="mt-2 text-[14px] text-white/85">od {max} mesta</p>}
            </>
          ) : (
            <>
              <p className="font-display text-[26px] font-bold leading-tight">Grad spava</p>
              <p className="mt-2 text-[14px] text-white/80">Server trenutno ne odgovara. Novosti su na Discordu.</p>
            </>
          )}
        </div>
      </div>
      <span className="tabla-stub left-[22%]" aria-hidden="true" />
      <span className="tabla-stub right-[22%]" aria-hidden="true" />
    </div>
  );
}

import { GlobeAltIcon, ArrowDownCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';

export default function AcmeLogo() {
  return (
    <div
      className={`${lusitana.className} flex flex-row items-center leading-none text-white`}
    >
      <PaperAirplaneIcon className="h-12 w-12 rotate-[315deg]" />
      <p className="text-[44px]">GramBam</p>
    </div>
  );
}

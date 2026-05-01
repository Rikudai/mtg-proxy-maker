import { createSignal, Setter, For, Show } from "solid-js";
import InfoTab from "./info-tab";
import ScryfallSearchBox from "./scryfall-searchbox";
import { fetchVariants } from "../services/scryfall";
import { Card } from "../types/card";
import VariantsModal from "./variants-modal";

type SidebarProps = {
	language: string;
	setLanguage: Setter<string>;
	printVersos: boolean;
	setPrintVersos: Setter<boolean>;
	autoTranslate: boolean;
	setAutoTranslate: Setter<boolean>;
	onAddCard: (cardName: string, variant?: number) => void;
	onClearList: () => void;
	onRawListImport: (rawCardList: string) => void;
	onDownloadZip?: () => Promise<void>;
	onPrint?: () => void;
	isMTGOImporting?: boolean;
};

const deckExample = `
10 Forest
1 Beamtown Beatstick
1 Become Immense
1 Bite Down
1 Bladegriff Prototype
1 Blazing Crescendo
1 Blossoming Defense
1 Brute Force
1 Coiling Oracle
1 Cold-Eyed Selkie
1 Colossal Growth
1 Combat Research
1 Command Tower
1 Cosmic Hunger
1 Cultivate
1 Decisive Denial
1 Deeproot Wayfinder
1 Djinn Illuminatus
1 Eureka Moment
1 Evolving Wilds
1 Frontier Bivouac
1 Fully Grown
1 Gaea's Gift
1 Geode Golem
1 Giant Growth
1 Goldvein Pick
1 Groundswell
1 Growth Spiral
1 Gruul Guildgate
1 Gruul Turf
1 Harrow
1 Hunter's Insight
1 Inscription of Abundance
1 Invigorate
6 Island
1 Izzet Boilerworks
1 Izzet Guildgate
1 Joint Exploration
1 Kessig Wolf Run
1 Kodama's Reach
1 Master's Rebuke
1 Mercurial Spelldancer
6 Mountain
1 Mutagenic Growth
1 Neheb, Dreadhorde Champion
1 Oakhame Adversary
1 Ohran Viper
1 Ram Through
1 Roar of Challenge
1 Roiling Regrowth
1 Season of Growth
1 Shore Up
1 Simic Charm
1 Simic Growth Chamber
1 Simic Guildgate
1 Snake Umbra
1 Snakeskin Veil
1 Soul's Fire
1 Sticky Fingers
1 Stormchaser Drake
1 Sunder Shaman
1 Surrakar Spellblade
1 Tamiyo's Safekeeping
1 Temple of Abandon
1 Temple of Epiphany
1 Temple of Mystery
1 Temur Battle Rage
1 Temur Charm
1 Terramorphic Expanse
1 Titan's Strength
1 Titanic Growth
1 Trygon Predator
1 Tyvar's Stand
1 Vedalken Heretic
1 Vines of Vastwood
1 Xyris, the Writhing Storm
`.trim()

export default function Sidebar(props: SidebarProps) {
	const [rawCardListDialogOpen, setRawCardListDialogOpen] = createSignal(false);
	const [isDownloading, setIsDownloading] = createSignal(false);
	const [variantsModalOpen, setVariantsModalOpen] = createSignal(false);
	const [variants, setVariants] = createSignal<Partial<Card>[]>([]);
	const [selectedCardName, setSelectedCardName] = createSignal("");
	const [isLoadingVariants, setIsLoadingVariants] = createSignal(false);

	const handleAddCardClick = async (name: string) => {
		setSelectedCardName(name);
		setIsLoadingVariants(true);
		setVariantsModalOpen(true);
		try {
			const fetchedVariants = await fetchVariants(name);
			if (fetchedVariants.length === 0) {
				// Sem variantes disponíveis: adiciona diretamente sem abrir o modal
				setVariantsModalOpen(false);
				props.onAddCard(name, 0);
				return;
			}
			setVariants(fetchedVariants);
		} catch (e) {
			console.error(e);
			setVariantsModalOpen(false);
			props.onAddCard(name); // Fallback to default if variants fail
		} finally {
			setIsLoadingVariants(false);
		}
	};

	return (
		<>
			<aside class="h-full shadow-2xl overflow-y-auto print:hidden w-80 bg-mtg-black border-r border-mtg-white/10 custom-scrollbar">
				<div class="flex flex-col h-full gap-8 p-6">
					{/* Brand/Header */}
					<div class="flex items-center gap-3 pb-2">
						<img src="/favicon-32x32.png" alt="Proxy Maker" class="w-10 h-10" />
						<div>
							<h1 class="font-beleren text-lg tracking-widest text-mtg-white uppercase leading-none">Proxy Maker</h1>
							<span class="text-[10px] text-mtg-gold uppercase tracking-[0.2em] font-bold">Multiverse Edition</span>
						</div>
					</div>

					{/* Section: Global Settings */}
					<div class="space-y-4">
						<h3 class="text-[10px] font-bold text-mtg-stone-500 uppercase tracking-widest px-1">Global Settings</h3>
						
						<label class="form-control w-full">
							<div class="label pt-0">
								<span class="label-text text-mtg-stone-400 text-xs font-semibold">Card Language</span>
							</div>
							<select
								name="language"
								value={props.language}
								onChange={(e) => {
									props.setLanguage(e.target.value);
								}}
								class="select select-bordered bg-mtg-stone-900 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all"
							>
								<option value="en">English</option>
								<option value="sp">Spanish</option>
								<option value="fr">French</option>
								<option value="de">German</option>
								<option value="it">Italian</option>
								<option value="pt">Portuguese</option>
								<option value="jp">Japanese</option>
								<option value="ko">Korean</option>
								<option value="ru">Russian</option>
								<option value="cs">Simplified Chinese</option>
								<option value="ct">Traditional Chinese</option>
								<option value="ph">Phyrexian</option>
							</select>
						</label>

						<div class="flex items-center justify-between p-3 rounded-xl bg-mtg-stone-900 border border-mtg-white/5">
							<span class="text-xs font-semibold text-mtg-stone-400">Print Card Backs</span>
							<input
								name="print-versos"
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								onChange={(e) => props.setPrintVersos(e.currentTarget.checked)}
								checked={props.printVersos}
							/>
						</div>
						
						<div class="flex items-center justify-between p-3 rounded-xl bg-mtg-stone-900 border border-mtg-white/5">
							<div class="flex flex-col">
								<span class="text-xs font-semibold text-mtg-stone-400">Auto Translate</span>
								<span class="text-[9px] text-mtg-stone-500 font-medium uppercase tracking-tighter">LLM & Google Bypass</span>
							</div>
							<input
								name="auto-translate"
								type="checkbox"
								class="toggle toggle-secondary toggle-sm"
								onChange={(e) => props.setAutoTranslate(e.currentTarget.checked)}
								checked={props.autoTranslate}
							/>
						</div>
					</div>

					{/* Section: Acquisition (Blue) */}
					<div class="space-y-4">
						<h3 class="text-[10px] font-bold text-mtg-blue uppercase tracking-widest px-1">Acquisition</h3>
						
						<ScryfallSearchBox onAddCard={({ name }) => handleAddCardClick(name)} />
						
						<button
							type="button"
							class="group flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-mtg-stone-900 border border-mtg-blue/30 text-mtg-blue font-bold text-sm hover:bg-mtg-blue hover:text-mtg-white transition-all duration-300 shadow-glow-blue/0 hover:shadow-glow-blue"
							disabled={props.isMTGOImporting}
							onClick={() => setRawCardListDialogOpen(true)}
						>
							<Show when={props.isMTGOImporting} fallback={
								<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
							}>
								<span class="loading loading-spinner loading-xs"></span>
							</Show>
							Import MTGO List
						</button>
					</div>

					{/* Section: Actions (Red/Green/White) */}
					<div class="space-y-3 pt-2">
						<h3 class="text-[10px] font-bold text-mtg-stone-500 uppercase tracking-widest px-1">Export & Cleanup</h3>
						
						<div class="grid grid-cols-2 gap-3">
							<button
								type="button"
								class="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-mtg-stone-900 border border-mtg-red/30 text-mtg-red hover:bg-mtg-red hover:text-white transition-all duration-300"
								onClick={() => props.onClearList()}
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17" stroke="currentColor" stroke-width="2"/><line x1="14" x2="14" y1="11" y2="17" stroke="currentColor" stroke-width="2"/></svg>
								<span class="text-[10px] font-bold uppercase">Clear</span>
							</button>

							<button
								type="button"
								class="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-mtg-stone-900 border border-mtg-white/10 text-mtg-white hover:bg-mtg-white hover:text-mtg-black transition-all duration-300"
								onClick={() => props.onPrint?.() || print()}
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14" fill="currentColor"/></svg>
								<span class="text-[10px] font-bold uppercase">Print</span>
							</button>
						</div>

						<button
							type="button"
							class="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl bg-mtg-stone-900 border border-mtg-green/30 text-mtg-green font-bold text-sm hover:bg-mtg-green hover:text-mtg-white transition-all duration-300"
							disabled={isDownloading() || !props.onDownloadZip}
							onClick={async () => {
								if (props.onDownloadZip) {
									setIsDownloading(true);
									try {
										await props.onDownloadZip();
									} finally {
										setIsDownloading(false);
									}
								}
							}}
						>
							<Show when={isDownloading()} fallback={
								<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="12" x2="12" y1="15" y2="3" stroke="currentColor" stroke-width="2" fill="none"/></svg>
							}>
								<span class="loading loading-spinner loading-xs"></span>
							</Show>
							Download ZIP Package
						</button>
					</div>

					<div class="mt-auto pt-6 border-t border-mtg-white/5">
						<InfoTab />
					</div>
				</div>
			</aside>

			<dialog
				class="z-[110] modal modal-bottom sm:modal-middle"
				open={rawCardListDialogOpen()}
			>
				<div class="modal-backdrop bg-mtg-black" onClick={() => setRawCardListDialogOpen(false)} />
				<div class="modal-box border border-mtg-white/10 p-0 overflow-hidden rounded-3xl max-w-2xl bg-mtg-stone-900">
					<div class="p-6 border-b border-mtg-white/10 bg-mtg-stone-900 flex items-center justify-between">
						<h2 class="text-xl font-beleren tracking-widest uppercase text-mtg-blue">Import MTGO List</h2>
						<button onClick={() => setRawCardListDialogOpen(false)} class="text-mtg-stone-500 hover:text-mtg-white">
							<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
						</button>
					</div>
					
					<form
						class="p-6 flex flex-col gap-6"
						onSubmit={async (e) => {
							e.preventDefault();
							const rawCardList = (e.target as HTMLFormElement).cardList.value;
							props.onRawListImport(rawCardList);
							setRawCardListDialogOpen(false);
						}}
					>
						<div class="space-y-2">
							<p class="text-sm text-mtg-stone-400">
								Paste your deck list below. The parser supports standard MTGO/Arena formats (Quantity Name).
							</p>
							<textarea 
								name="cardList" 
								class="textarea textarea-bordered w-full h-64 bg-mtg-black border-mtg-white/10 text-mtg-stone-200 font-mono text-sm focus:border-mtg-blue custom-scrollbar" 
								placeholder={deckExample} 
							/>
						</div>

						<div class="flex gap-3">
							<button
								class="btn flex-1 bg-mtg-stone-800 border-mtg-white/10 text-mtg-stone-300 hover:bg-mtg-stone-700"
								type="button"
								onClick={() => setRawCardListDialogOpen(false)}
							>
								Cancel
							</button>
							<button type="submit" class="btn btn-primary flex-1 shadow-glow-blue border-none">Start Import</button>
						</div>
					</form>
				</div>
			</dialog>

			<VariantsModal
				open={variantsModalOpen()}
				onClose={() => setVariantsModalOpen(false)}
				variants={variants()}
				isLoading={isLoadingVariants()}
				cardName={selectedCardName()}
				onSelect={(index) => {
					props.onAddCard(selectedCardName(), index);
					setVariantsModalOpen(false);
				}}
			/>
		</>
	);
}

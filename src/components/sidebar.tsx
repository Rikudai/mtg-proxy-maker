import { createSignal, Setter, For, Show } from "solid-js";
import InfoTab from "./info-tab";
import ScryfallSearchBox from "./scryfall-searchbox";
import { fetchVariants } from "../services/scryfall";
import { Card } from "../types/card";

type SidebarProps = {
	language: string;
	setLanguage: Setter<string>;
	printVersos: boolean;
	setPrintVersos: Setter<boolean>;
	onAddCard: (cardName: string, variant?: number) => void;
	onClearList: () => void;
	onRawListImport: (rawCardList: string) => void;
	onDownloadZip?: () => Promise<void>;
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
			setVariants(fetchedVariants);
		} catch (e) {
			console.error(e);
			props.onAddCard(name); // Fallback to default if variants fail
			setVariantsModalOpen(false);
		} finally {
			setIsLoadingVariants(false);
		}
	};

	return (
		<>
			<aside class="h-full shadow-xl overflow-y-hidden print:hidden w-full bg-stone-500">
				<div class="flex flex-col h-full gap-5 p-5">
					<label class="form-control">
						<div class="label-text text-white">Card language</div>
						<select
							name="language"
							value={props.language}
							onChange={(e) => {
								props.setLanguage(e.target.value);
							}}
							class="select"
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
					<ScryfallSearchBox onAddCard={({ name }) => handleAddCardClick(name)} />
					<button
						type="button"
						class="btn btn-secondary w-full"
						disabled={props.isMTGOImporting}
						onClick={() => setRawCardListDialogOpen(true)}
					>
						{props.isMTGOImporting ? (
							<span class="loading loading-spinner loading-sm"></span>
						) : (
							"Import from MTGO"
						)}
					</button>
					<button
						type="button"
						class="btn btn-secondary w-full"
						onClick={() => props.onClearList()}
					>
						Clear list
					</button>
					<button
						type="button"
						class="btn btn-primary w-full"
						onClick={() => {
							print();
						}}
					>
						Print all cards
					</button>

					<button
						type="button"
						class="btn btn-primary w-full"
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
						{isDownloading() ? (
							<span class="loading loading-spinner loading-md bg-white"></span>
						) : (
							"Download ZIP (PNGs)"
						)}
					</button>

					<div class="form-control">
						<label class="label cursor-pointer">
							<span class="label-text ml-auto mr-5 text-white">
								Print card backs
							</span>
							<input
								name="print-versos"
								type="checkbox"
								class="toggle toggle-primary"
								onChange={(e) => props.setPrintVersos(e.currentTarget.checked)}
								checked={props.printVersos}
							/>
						</label>
					</div>

					<InfoTab />
				</div>
			</aside>

			<dialog
				class="z-20 modal modal-bottom sm:modal-middle"
				open={rawCardListDialogOpen()}
			>
				<form method="dialog" class="modal-backdrop bg-black/50" onClick={() => setRawCardListDialogOpen(false)} >
					<button>close</button>
				</form>
				<form
					method="dialog"
					class="modal-box flex flex-col gap-5 bg-stone-600"
					onSubmit={async (e) => {
						e.preventDefault();
						const rawCardList = (e.target as HTMLFormElement).cardList.value;
						props.onRawListImport(rawCardList);
						setRawCardListDialogOpen(false);
					}}
				>
					<label for="cardList" class="label-text text-white">
						Paste your card list here <br />
						Unsupported cards will be skipped.
					</label>
					<textarea name="cardList" class="textarea h-full" rows={12} placeholder={deckExample} />

					<div class="modal-action">
						<div class="w-full flex gap-2">
							<button
								class="btn btn-secondary flex-1"
								type="reset"
								onClick={() => setRawCardListDialogOpen(false)}
							>
								Cancel
							</button>
							<button type="submit" class="btn btn-primary flex-1">Submit</button>
						</div>
					</div>
				</form>
			</dialog>
			<dialog
				class="z-30 modal modal-bottom sm:modal-middle"
				open={variantsModalOpen()}
			>
				<div class="modal-box bg-stone-700 max-w-4xl">
					<h3 class="font-bold text-lg text-white mb-4">Select Art: {selectedCardName()}</h3>
					<Show when={isLoadingVariants()}>
						<div class="flex justify-center p-10">
							<span class="loading loading-spinner loading-lg text-primary"></span>
						</div>
					</Show>
					<div class="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto max-h-[70vh]">
						<For each={variants()}>
							{(variant, index) => (
								<button
									class="hover:ring-4 hover:ring-primary rounded-lg overflow-hidden transition-all"
									onClick={() => {
										props.onAddCard(selectedCardName(), index());
										setVariantsModalOpen(false);
									}}
								>
									<img src={variant.artUrl} alt={`Variant ${index()}`} class="w-full h-auto" />
									<div class="bg-black/50 text-white text-xs p-1 text-center">
										{variant.set?.toUpperCase()} - {variant.rarity}
									</div>
								</button>
							)}
						</For>
					</div>
					<div class="modal-action">
						<button class="btn" onClick={() => setVariantsModalOpen(false)}>Cancel</button>
					</div>
				</div>
				<form method="dialog" class="modal-backdrop bg-black/70" onClick={() => setVariantsModalOpen(false)}>
					<button>close</button>
				</form>
			</dialog>
		</>
	);
}

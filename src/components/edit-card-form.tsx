import {
	Accessor,
	createEffect,
	createSignal, Show, For
} from "solid-js";
import { defaultVerso, setDefaultVerso } from "../app";
import { parseMana, serializeMana } from "../services/scryfall";
import { cardColors, cardFrames } from "../types/backgrounds";
import { Card } from "../types/card";
import CardComponent from "./card/card";
import CardVerso from "./card/card-verso";
import VariantsModal from "./variants-modal";
import { fetchVariants } from "../services/scryfall";

function ManaInput(props: {
	value: Card["manaCost"];
	setValue: (value: Card["manaCost"]) => void;
}) {
	const [rawManaCost, setRawManaCost] = createSignal("");

	createEffect(function syncMana() {
		const serialized = serializeMana(props.value);
		setRawManaCost(serialized);
	});

	createEffect(function syncManaFromInput() {
		const parsed = parseMana(rawManaCost());
		if (props.value.join("") != parsed.join("")) {
			props.setValue(parsed);
		}
	});

	return (
		<div class="relative group">
			<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mtg-stone-500 group-focus-within:text-mtg-blue transition-colors">
				<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/></svg>
			</div>
			<input
				name="mana"
				class="input input-bordered w-full pl-10 bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all rounded-xl placeholder:text-mtg-stone-700 font-mono"
				onInput={(e) => setRawManaCost(e.currentTarget.value)}
				value={rawManaCost()}
				placeholder="e.g. 2UB"
			/>
		</div>
	);
}

const TABS = [
	{ id: 'visuals', label: 'Visuals', icon: <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>, color: 'text-mtg-blue' },
	{ id: 'data', label: 'General', icon: <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2"/><line x1="16" x2="8" y1="13" y2="13" stroke="currentColor" stroke-width="2"/><line x1="16" x2="8" y1="17" y2="17" stroke="currentColor" stroke-width="2"/><line x1="10" x2="8" y1="9" y2="9" stroke="currentColor" stroke-width="2"/></svg>, color: 'text-mtg-white' },
	{ id: 'stats', label: 'Stats/Print', icon: <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3" stroke="currentColor" stroke-width="2"/></svg>, color: 'text-mtg-green' },
	{ id: 'back', label: 'Back', icon: <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2" stroke="currentColor" stroke-width="2"/><path d="M13 17v2" stroke="currentColor" stroke-width="2"/><path d="M13 11v2" stroke="currentColor" stroke-width="2"/></svg>, color: 'text-mtg-red' },
];

export default function EditCardForm(props: {
	card: Accessor<Card>;
	setCard: (fn: (prev: Card) => Card) => void;
	onRemoveCard: () => void;
	onDuplicateCard: () => void;
	onSetCardDefaultVerso: (verso: string) => void;
}) {
	const [showBack, setShowBack] = createSignal(false);
	const [activeTab, setActiveTab] = createSignal('visuals');
	const [variantsModalOpen, setVariantsModalOpen] = createSignal(false);
	const [variants, setVariants] = createSignal<Partial<Card>[]>([]);
	const [isLoadingVariants, setIsLoadingVariants] = createSignal(false);

	const handleArtClick = async () => {
		if (showBack()) return;
		const cardName = props.card().originalName || props.card().title;
		if (!cardName) return;

		setIsLoadingVariants(true);
		setVariantsModalOpen(true);
		try {
			const fetchedVariants = await fetchVariants(cardName);
			setVariants(fetchedVariants);
		} catch (e) {
			console.error(e);
		} finally {
			setIsLoadingVariants(false);
		}
	};

	return (
		<div class="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0 h-full overflow-hidden">
			{/* Preview Column */}
			<section class="bg-mtg-black p-8 border-r border-mtg-white/10 flex flex-col items-center justify-between">
				<div class="flex flex-col gap-6 items-center w-full">
					<Show when={props.card().verso}>
						<div class="flex items-center bg-mtg-stone-900 p-1 rounded-xl border border-mtg-white/10 w-fit">
							<button 
								class={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${!showBack() ? 'bg-mtg-gold text-mtg-black shadow-glow-gold' : 'text-mtg-stone-500 hover:text-mtg-stone-300'}`}
								onClick={() => setShowBack(false)}
							>
								Front
							</button>
							<button 
								class={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${showBack() ? 'bg-mtg-gold text-mtg-black shadow-glow-gold' : 'text-mtg-stone-500 hover:text-mtg-stone-300'}`}
								onClick={() => setShowBack(true)}
							>
								Back
							</button>
						</div>
					</Show>

					<div class="relative group cursor-pointer card-hover-effect">
						<div class={`transition-all duration-500 ${showBack() ? 'opacity-0 scale-95 pointer-events-none absolute inset-0' : 'opacity-100 scale-100'}`}>
							<CardComponent card={props.card()} onArtClick={handleArtClick} />
						</div>
						<Show when={props.card().verso}>
							<div class={`transition-all duration-500 ${!showBack() ? 'opacity-0 scale-95 pointer-events-none absolute inset-0' : 'opacity-100 scale-100'}`}>
								<CardVerso verso={props.card().verso} onArtClick={handleArtClick} />
							</div>
						</Show>
						
						{!showBack() && (
							<div 
								class="absolute top-[8mm] left-0 right-0 bottom-0 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-mtg-black/40 rounded-2xl"
								onClick={handleArtClick}
							>
								<span class="bg-mtg-gold text-mtg-black px-4 py-2 rounded-full text-xs font-bold shadow-glow-gold pointer-events-auto">
									Switch Art
								</span>
							</div>
						)}
					</div>
				</div>

				<div class="w-full flex flex-col gap-2 pt-8 mt-auto border-t border-mtg-white/10">
					<button
						class="w-full py-2.5 rounded-xl bg-mtg-stone-900 border border-mtg-blue/30 text-mtg-blue font-bold text-xs hover:bg-mtg-blue hover:text-mtg-white transition-all flex items-center justify-center gap-2"
						onClick={() => props.onDuplicateCard()}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
						Duplicate Card
					</button>
					<button
						class="w-full py-2.5 rounded-xl bg-mtg-stone-900 border border-mtg-red/30 text-mtg-red font-bold text-xs hover:bg-mtg-red hover:text-white transition-all flex items-center justify-center gap-2"
						onClick={() => props.onRemoveCard()}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
						Delete Card
					</button>
				</div>
			</section>

			{/* Form Column */}
			<section class="flex flex-col h-full bg-mtg-black">
				{/* Tabs Header */}
				<div class="flex items-center px-4 pt-4 border-b border-mtg-white/10 gap-1 bg-mtg-stone-900/50">
					<For each={TABS}>
						{(tab) => (
							<button
								onClick={() => setActiveTab(tab.id)}
								class={`flex items-center gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${
									activeTab() === tab.id 
									? 'border-mtg-gold text-mtg-gold bg-white/5' 
									: 'border-transparent text-mtg-stone-500 hover:text-mtg-stone-300'
								}`}
							>
								<span class={`w-4 h-4 ${activeTab() === tab.id ? tab.color : 'opacity-50'}`}>{tab.icon}</span>
								{tab.label}
							</button>
						)}
					</For>
				</div>

				<div class="flex-1 overflow-y-auto p-10 custom-scrollbar">
					<form class="max-w-xl mx-auto space-y-10" onSubmit={(e) => e.preventDefault()}>
						
						<Show when={activeTab() === 'visuals'}>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<label class="form-control col-span-2">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Card Picture</span>
									<div class="flex gap-2">
										<input
											name="picture"
											value={props.card().artUrl}
											onInput={(e) => props.setCard((p) => ({ ...p, artUrl: e.currentTarget.value }))}
											class="input input-bordered flex-1 bg-mtg-stone-900 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all rounded-xl text-sm"
											placeholder="https://..."
										/>
										<label class="flex items-center justify-center px-4 rounded-xl bg-mtg-stone-900 border border-mtg-blue/30 text-mtg-blue cursor-pointer hover:bg-mtg-blue hover:text-mtg-white transition-all">
											<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
											<input type="file" class="hidden" accept="image/*" onChange={(e) => {
												const file = e.currentTarget.files?.item(0);
												if (!file) return;
												const reader = new FileReader();
												reader.onload = (ev) => props.setCard(p => ({ ...p, artUrl: ev.target?.result as string }));
												reader.readAsDataURL(file);
											}} />
										</label>
									</div>
								</label>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Frame Style</span>
									<select
										name="frame"
										value={props.card().aspect.frame}
										onChange={(e) => props.setCard((p) => ({ 
											...p, aspect: { ...p.aspect, frame: e.currentTarget.value as any } 
										}))}
										class="select select-bordered bg-mtg-stone-900 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all rounded-xl"
									>
										{cardFrames.map((f) => <option value={f}>{f}</option>)}
									</select>
								</label>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Base Color</span>
									<select
										name="color"
										value={props.card().aspect.color}
										onChange={(e) => props.setCard((p) => ({ 
											...p, aspect: { ...p.aspect, color: e.currentTarget.value as any } 
										}))}
										class="select select-bordered bg-mtg-stone-900 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all rounded-xl"
									>
										{cardColors.map((c) => <option value={c}>{c}</option>)}
									</select>
								</label>

								<div class="col-span-2 p-4 rounded-2xl bg-mtg-stone-900 border border-mtg-white/10 mt-2">
									<label class="flex items-center justify-between cursor-pointer group">
										<div class="flex items-center gap-3">
											<div class="w-8 h-8 rounded-lg bg-mtg-stone-800 flex items-center justify-center text-mtg-gold transition-all">
												<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M19 16v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3"/></svg>
											</div>
											<span class="text-sm font-bold text-mtg-stone-200 uppercase tracking-wider">Legendary Card</span>
										</div>
										<input
											name="legendary"
											type="checkbox"
											class="checkbox checkbox-primary rounded-lg border-mtg-white/20"
											checked={props.card().aspect.legendary}
											onChange={(e) => props.setCard((p) => ({ 
												...p, aspect: { ...p.aspect, legendary: e.currentTarget.checked } 
											}))}
										/>
									</label>
								</div>
							</div>
						</Show>

						<Show when={activeTab() === 'data'}>
							<div class="space-y-6">
								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Card Title</span>
									<input
										name="title"
										class="input input-bordered bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all rounded-xl font-bold tracking-wide"
										onInput={(e) => props.setCard((p) => ({ ...p, title: e.currentTarget.value }))}
										value={props.card().title}
									/>
								</label>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Mana Cost</span>
									<ManaInput
										value={props.card().manaCost}
										setValue={(m) => props.setCard((p) => ({ ...p, manaCost: m }))}
									/>
								</label>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Type Line</span>
									<input
										name="type"
										class="input input-bordered bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all rounded-xl text-sm italic"
										onInput={(e) => props.setCard((p) => ({ ...p, typeText: e.currentTarget.value }))}
										value={props.card().typeText ?? ""}
									/>
								</label>

								<label class="form-control group">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1 flex justify-between">
										Oracle Text
										<span class="text-[10px] text-mtg-blue opacity-50 font-mono">Use {'{T}'}, {'{2/B}'}, etc.</span>
									</span>
									<textarea
										name="oracle"
										rows={4}
										class="textarea textarea-bordered bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all rounded-2xl text-sm leading-relaxed custom-scrollbar"
										onInput={(e) => props.setCard((p) => ({ ...p, oracleText: e.currentTarget.value }))}
										value={props.card().oracleText ?? ""}
									/>
								</label>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1 italic">Flavor Text</span>
									<textarea
										name="flavor"
										rows={2}
										class="textarea textarea-bordered bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-500 focus:border-mtg-blue transition-all rounded-2xl text-sm italic italic leading-relaxed custom-scrollbar"
										onInput={(e) => props.setCard((p) => ({ ...p, flavorText: e.currentTarget.value }))}
										value={props.card().flavorText ?? ""}
									/>
								</label>
							</div>
						</Show>

						<Show when={activeTab() === 'stats'}>
							<div class="grid grid-cols-2 gap-6">
								<div class="col-span-2 grid grid-cols-2 gap-4 p-4 rounded-2xl bg-mtg-white/5 border border-mtg-white/5 mb-2">
									<label class="form-control">
										<span class="label-text text-mtg-stone-400 text-[10px] font-bold uppercase tracking-widest mb-1 px-1">Power</span>
										<input
											name="power"
											class="input input-bordered input-sm bg-mtg-stone-950 border-mtg-white/10 text-mtg-white focus:border-mtg-gold transition-all rounded-lg font-bold text-center"
											onInput={(e) => props.setCard((p) => ({ ...p, power: e.currentTarget.value }))}
											value={props.card().power ?? ""}
										/>
									</label>
									<label class="form-control">
										<span class="label-text text-mtg-stone-400 text-[10px] font-bold uppercase tracking-widest mb-1 px-1">Toughness</span>
										<input
											name="toughness"
											class="input input-bordered input-sm bg-mtg-stone-950 border-mtg-white/10 text-mtg-white focus:border-mtg-gold transition-all rounded-lg font-bold text-center"
											onInput={(e) => props.setCard((p) => ({ ...p, toughness: e.currentTarget.value }))}
											value={props.card().toughness ?? ""}
										/>
									</label>
								</div>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Collector #</span>
									<input
										name="collector"
										class="input input-bordered bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-300 focus:border-mtg-green transition-all rounded-xl text-sm"
										onInput={(e) => props.setCard((p) => ({ ...p, collectorNumber: e.currentTarget.value }))}
										value={props.card().collectorNumber ?? ""}
									/>
								</label>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Rarity</span>
									<input
										name="rarity"
										class="input input-bordered bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-300 focus:border-mtg-green transition-all rounded-xl text-sm"
										onInput={(e) => props.setCard((p) => ({ ...p, rarity: e.currentTarget.value }))}
										value={props.card().rarity ?? ""}
									/>
								</label>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Set Code</span>
									<input
										name="set"
										class="input input-bordered bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-300 focus:border-mtg-green transition-all rounded-xl text-sm font-mono uppercase"
										onInput={(e) => props.setCard((p) => ({ ...p, set: e.currentTarget.value }))}
										value={props.card().set ?? ""}
									/>
								</label>

								<label class="form-control">
									<span class="label-text text-mtg-stone-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Artist Name</span>
									<input
										name="artist"
										class="input input-bordered bg-mtg-stone-950/50 border-mtg-white/10 text-mtg-stone-300 focus:border-mtg-green transition-all rounded-xl text-sm"
										onInput={(e) => props.setCard((p) => ({ ...p, artist: e.currentTarget.value }))}
										value={props.card().artist ?? ""}
									/>
								</label>
							</div>
						</Show>

						<Show when={activeTab() === 'back'}>
							<div class="space-y-6">
								<div class="p-6 rounded-2xl bg-mtg-red/5 border border-mtg-red/10 flex flex-col gap-6">
									<label class="form-control">
										<span class="label-text text-mtg-red text-xs font-bold uppercase tracking-widest mb-2 px-1">Card Back Picture</span>
										<div class="flex gap-2">
											<input
												name="back-picture"
												value={(props.card().verso ?? "") as string}
												onInput={(e) => props.setCard((p) => ({ ...p, verso: e.currentTarget.value }))}
												class="input input-bordered flex-1 bg-mtg-stone-950/50 border-mtg-red/20 text-mtg-stone-200 focus:border-mtg-red transition-all rounded-xl text-sm"
												placeholder="https://..."
											/>
											<label class="flex items-center justify-center px-4 rounded-xl bg-mtg-red/10 border border-mtg-red/30 text-mtg-red cursor-pointer hover:bg-mtg-red hover:text-mtg-white transition-all">
												<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
												<input type="file" class="hidden" accept="image/*" onChange={(e) => {
													const file = e.currentTarget.files?.item(0);
													if (!file) return;
													const reader = new FileReader();
													reader.onload = (ev) => props.setCard(p => ({ ...p, verso: ev.target?.result as string }));
													reader.readAsDataURL(file);
												}} />
											</label>
										</div>
									</label>

									<button
										type="button"
										class="w-full py-4 rounded-xl bg-mtg-stone-950 text-white border border-mtg-white/10 font-bold text-xs uppercase tracking-widest hover:border-mtg-gold hover:text-mtg-gold transition-all flex items-center justify-center gap-2 disabled:opacity-30"
										disabled={defaultVerso() == props.card().verso || props.card().verso == "default"}
										onClick={() => {
											const url = props.card().verso;
											props.setCard((p) => ({ ...p, verso: "default" }));
											setDefaultVerso(url as string);
										}}
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
										Make Local Default Back
									</button>
								</div>
							</div>
						</Show>

					</form>
				</div>
			</section>

			<VariantsModal
				open={variantsModalOpen()}
				onClose={() => setVariantsModalOpen(false)}
				variants={variants()}
				isLoading={isLoadingVariants()}
				cardName={props.card().title}
				onSelect={(index) => {
					const variant = variants()[index];
					props.setCard((p) => ({ 
						...p, 
						artUrl: variant.artUrl || p.artUrl,
						artist: variant.artist || p.artist,
						set: variant.set || p.set,
						rarity: variant.rarity || p.rarity,
						collectorNumber: variant.collectorNumber || p.collectorNumber,
					}));
					setVariantsModalOpen(false);
				}}
			/>
		</div>
	);
}

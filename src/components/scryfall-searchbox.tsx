import { createEffect, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { searchCard } from "../services/scryfall";
import { ListCard } from "../types/list-card";

type ScryfallSearchBoxProps = {
	onAddCard: (card: Pick<ListCard, "name" | "type">) => void;
};

export default function ScryfallSearchBox(props: ScryfallSearchBoxProps) {
	const [search, setSearch] = createSignal("");
	const [debouncedSearch, setDebouncedSearch] = createSignal("");
	const [showResults, setShowResults] = createSignal(false);

	// Debounce: espera 500ms após última digitação antes de buscar
	createEffect(() => {
		const value = search();
		const timer = setTimeout(() => {
			setDebouncedSearch(value);
		}, 500);
		onCleanup(() => clearTimeout(timer));
	});

	const [results] = createResource(
		() => (debouncedSearch().length >= 3 ? debouncedSearch() : null),
		searchCard
	);

	return (
		<div class="form-control relative w-full">
			<div class="relative group">
				<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mtg-stone-500 group-focus-within:text-mtg-blue transition-colors">
					<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
				</div>
				<input
					type="text"
					class="input input-bordered w-full pl-10 bg-mtg-stone-900/50 border-mtg-white/10 text-mtg-stone-200 focus:border-mtg-blue transition-all rounded-xl placeholder:text-mtg-stone-600 sm:text-sm"
					placeholder="Search cards..."
					onInput={(e) => {
						setSearch(e.currentTarget.value);
						setShowResults(true);
					}}
					onFocus={() => setShowResults(true)}
					value={search()}
				/>
			</div>
			
			<Show when={showResults() && search().length >= 3}>
				<div class="absolute top-12 z-[120] w-full bg-mtg-stone-900 border border-mtg-white/10 rounded-2xl shadow-glass overflow-hidden max-h-80 flex flex-col">
					<Show when={results.loading}>
						<div class="p-4 flex items-center justify-center gap-3 text-mtg-stone-400 text-sm italic">
							<span class="loading loading-spinner loading-xs"></span>
							Searching Scryfall...
						</div>
					</Show>
					
					<Show when={!results.loading && results()}>
						<div class="overflow-y-auto custom-scrollbar p-2 bg-mtg-black">
							<For each={results()}>
								{(result) => (
									<button
										class="w-full text-left px-4 py-3 rounded-xl text-sm text-mtg-stone-300 hover:bg-mtg-blue hover:text-white transition-all flex flex-col group"
										onClick={() => {
											props.onAddCard({ 
												name: result.name,
												type: result.type_line
											});
											setSearch("");
											setShowResults(false);
										}}
									>
										<span class="font-bold">{result.name}</span>
										<span class="text-[10px] text-mtg-stone-500 group-hover:text-mtg-blue-200 truncate font-mono">
											{result.type_line}
										</span>
									</button>
								)}
							</For>
						</div>
					</Show>

					<Show when={!results.loading && results()?.length === 0}>
						<div class="p-4 text-center text-mtg-stone-500 text-sm italic">
							No cards found
						</div>
					</Show>
				</div>
			</Show>

			{/* Backdrop for closing results when clicking outside */}
			<Show when={showResults() && search().length >= 3}>
				<div 
					class="fixed inset-0 z-[115]" 
					onClick={() => setShowResults(false)}
				/>
			</Show>
		</div>
	);
}

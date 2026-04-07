import {
	createEffect,
	createResource,
	createSignal, For, untrack,
	Show,
	onMount,
	onCleanup
} from "solid-js";
import { createStore } from "solid-js/store";
import CardComponent from "./components/card/card";
import CardVerso from "./components/card/card-verso";
import EditCardForm from "./components/edit-card-form";
import Sidebar from "./components/sidebar";
import { parseMtgo } from "./services/mtgo-parser";
import { fetchCard } from "./services/scryfall";
import { Card, getEmptyCard } from "./types/card";
import toast, { Toaster } from "solid-toast";
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CardError } from "./types/error";
import { toastError } from "./services/toaster";

function createResourceStore<T extends {}>(
	initialValue: T,
	...args: Parameters<typeof createResource<T>>
) {
	const [resource] = createResource<T>(...args);
	const [store, setStore] = createStore<T>(initialValue);

	const signal = () => ({
		value: store,
		state: resource.state,
		error: resource.error,
		loading: resource.loading,
	});

	createEffect(() => {
		if (resource.latest) {
			setStore(resource.latest);
		}
	});

	return [signal, setStore] as const;
}

export const [defaultVerso, setDefaultVerso] = createSignal<string>(
	localStorage.getItem("defaultVerso") || "",
);

export default function App() {
	createEffect(function syncDefaultVersoWithLocalStorage() {
		localStorage.setItem("defaultVerso", defaultVerso());
	});

	const url = new URL(window.location.href);

	const rawLanguage =
		url.searchParams.get("language") ??
		localStorage.getItem("language") ??
		"en";

	const [language, setLanguage] = createSignal(rawLanguage);
	const [printVersos, setPrintVersos] = createSignal(
		localStorage.getItem("printVersos") == "true",
	);
	const [isMTGOImporting, setIsMTGOImporting] = createSignal(false);
	const [importProgress, setImportProgress] = createSignal<{ current: number, total: number, cardName: string } | null>(null);
	const [exportProgress, setExportProgress] = createSignal<{ current: number, total: number, cardName: string } | null>(null);

	const [cardList, setCardList] = createResourceStore<Card[]>([], () =>
		getCardList(),
	);

	const [selectedCardIndex, setSelectedCardIndex] = createSignal<number | null>(
		null,
	);

	const selectedCard = () =>
		selectedCardIndex() !== null
			? cardList().value[selectedCardIndex()!]
			: null;

	const setSelectedCard = (fn: (prev: Card) => Card) => {
		if (selectedCardIndex() == null || selectedCard() == null) return;
		setCardList(selectedCardIndex()!, fn(selectedCard()!));
	};

	async function fetchAndAddCard(name: string, variant: number = 0) {
		try {
			const fetchedCard = await fetchCard(name, language(), variant);

			setCardList((prev) => [...prev, fetchedCard]);
		} catch (e) {
			if (e instanceof CardError) {
				toastError(e)
			}
		}
	}

	async function getNewListFromMTGO(mtgoList: string) {
		const parsedList = parseMtgo(mtgoList);
		const tasks = parsedList.flatMap(({ name, number }) =>
			[...new Array(number)].map((_, i) => ({ name, i }))
		);

		const result: PromiseSettledResult<Card>[] = [];
		const concurrencyLimit = 1; // Processando 1 por 1 como solicitado
		
		setImportProgress({ current: 0, total: tasks.length, cardName: tasks[0]?.name || "Iniciando..." });

		for (let i = 0; i < tasks.length; i += concurrencyLimit) {
			const batch = tasks.slice(i, i + concurrencyLimit);
			
			if (batch.length > 0) {
				setImportProgress({ current: i + 1, total: tasks.length, cardName: batch[0].name });
			}

			const batchResults = await Promise.allSettled(
				batch.map(async (task) => {
					return fetchCard(task.name, language(), task.i);
				})
			);
			result.push(...batchResults);
			
			if (i + concurrencyLimit < tasks.length) {
				await new Promise(r => setTimeout(r, 60));
			}
		}

		console.debug('result', result)

		for (const { reason } of result.filter(r => r.status == 'rejected')) {
			if (reason instanceof CardError) {
				console.error(reason)
				toastError(reason);
			}
		}

		return result.filter((result) => result.status == 'fulfilled').map((result) => (result as PromiseFulfilledResult<Card>).value)
	}

	async function getCardList(): Promise<Card[]> {
		const urlCardList = url.searchParams.get("cardList");

		localStorage.removeItem("cardList"); // Limpa qualquer lixo da versão anterior

		if (urlCardList) {
			window.history.replaceState(null, "", "/");
			return getNewListFromMTGO(decodeURI(urlCardList));
		} else {
			return [];
		}
	}

	createEffect(function syncWithLocalStorage() {
		localStorage.setItem("language", language());
		localStorage.setItem("printVersos", printVersos() ? "true" : "false");
	});

	onMount(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			const currentCards = untrack(() => cardList().value);
			if (currentCards && currentCards.length > 0) {
				e.preventDefault();
				e.returnValue = "";
			}
		};
		
		window.addEventListener("beforeunload", handleBeforeUnload);
		onCleanup(() => window.removeEventListener("beforeunload", handleBeforeUnload));
	});

	createEffect(function updateCardsLang() {
		const lang = language();
		const clonedList = untrack(() => {
			const val = cardList().value;
			return JSON.parse(JSON.stringify(val)) as Card[];
		});
		setCardList(clonedList.map((c: any) => ({ ...c, lang })));
	});

	async function extractZip() {
		try {
			const zip = new JSZip();
			const elements = document.querySelectorAll('.card-export-target');
			if (elements.length === 0) {
				toast.error("Nenhuma carta no painel para exportar.");
				return;
			}

			setExportProgress({ current: 0, total: elements.length, cardName: "Preparando exportação..." });
			const nameCounts: Record<string, number> = {};

			for (let i = 0; i < elements.length; i++) {
				const node = elements[i] as HTMLElement;
				const baseName = node.dataset.name || "Card";
				
				setExportProgress({ current: i + 1, total: elements.length, cardName: baseName });

				// Pula a checagem manual quebrado de CORS no cache e adiciona cacheBust para que o html-to-image baixe de novo as scryfall imagens.
				const blob = await toPng(node, { pixelRatio: 2, cacheBust: true });
				const base64Data = blob.replace(/^data:image\/png;base64,/, "");

				nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
				
				const uniqueName = nameCounts[baseName] === 1 
					? baseName 
					: `${baseName} ${String(nameCounts[baseName] - 1).padStart(2, '0')}`;
				
				const safeName = uniqueName.replace(/[<>:"/\\|?*]+/g, '_');

				zip.file(`${safeName}.png`, base64Data, { base64: true });
			}

			setExportProgress({ current: elements.length, total: elements.length, cardName: "Comprimindo arquivo ZIP..." });
			const content = await zip.generateAsync({ type: 'blob' });
			saveAs(content, "mtg-proxies.zip");
			
			setExportProgress(null);
			toast.success("Download do pacote ZIP concluído!");
		} catch (error) {
			console.error("Failed to generate zip", error);
			setExportProgress(null);
			toast.error("Desculpe, ocorreu um erro ao gerar o arquivo ZIP.");
		}
	}

	return (
		<main class="md:grid md:grid-cols-[20rem_1fr] md:h-screen font-sans print:!block print:overflow-visible relative bg-mtg-stone-950 text-mtg-stone-100">
			<Toaster position="bottom-right" />
			
			{/* Overlays */}
			<Show when={exportProgress()}>
				{(progress) => (
					<div class="fixed inset-0 z-[100] flex items-center justify-center bg-mtg-black print:hidden">
						<div class="glass rounded-2xl p-8 max-w-lg w-full flex flex-col items-center gap-6 shadow-glass border-mtg-white/10">
							<div class="text-2xl font-beleren tracking-wider text-center text-mtg-white drop-shadow-md">
								Exporting Cards...
							</div>
							
							<div class="w-full relative">
								<div class="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-mtg-black shadow-inner w-full relative border border-mtg-white/5">
									<div 
										style={{ width: `${(progress().current / progress().total) * 100}%` }} 
										class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-mtg-blue to-mtg-green transition-all duration-300 ease-out"
									></div>
								</div>
								<div class="text-xs text-center text-mtg-stone-400 font-medium">
									{progress().current} of {progress().total} Processed
								</div>
							</div>

							<div class="bg-mtg-stone-900 w-full p-4 rounded-xl flex items-center gap-4 border border-mtg-white/5">
								<span class="loading loading-ring loading-md text-mtg-blue"></span>
								<div class="flex-1 overflow-hidden">
									<p class="text-[10px] text-mtg-stone-500 uppercase tracking-widest font-bold mb-1">Generating Image</p>
									<p class="text-base text-mtg-stone-200 truncate w-full italic">{progress().cardName}</p>
								</div>
							</div>
						</div>
					</div>
				)}
			</Show>

			<Show when={importProgress()}>
				{(progress) => (
					<div class="fixed inset-0 z-[100] flex items-center justify-center bg-mtg-black print:hidden">
						<div class="glass rounded-2xl p-8 max-w-lg w-full flex flex-col items-center gap-6 shadow-glass border-mtg-white/10">
							<div class="text-2xl font-beleren tracking-wider text-center text-mtg-white drop-shadow-md">
								Importing Cards...
							</div>
							
							<div class="w-full relative">
								<div class="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-mtg-black shadow-inner w-full relative border border-mtg-white/5">
									<div 
										style={{ width: `${(progress().current / progress().total) * 100}%` }} 
										class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-mtg-red to-mtg-gold transition-all duration-300 ease-out"
									></div>
								</div>
								<div class="text-xs text-center text-mtg-stone-400 font-medium">
									{progress().current} of {progress().total} Processed
								</div>
							</div>

							<div class="bg-mtg-stone-900 w-full p-4 rounded-xl flex items-center gap-4 border border-mtg-white/5">
								<span class="loading loading-ring loading-md text-mtg-gold"></span>
								<div class="flex-1 overflow-hidden">
									<p class="text-[10px] text-mtg-stone-500 uppercase tracking-widest font-bold mb-1">Parsing & Translating</p>
									<p class="text-base text-mtg-stone-200 truncate w-full italic">{progress().cardName}</p>
								</div>
							</div>
						</div>
					</div>
				)}
			</Show>

			<Sidebar
				onClearList={() => {
					setCardList([]);
					setSelectedCardIndex(null);
				}}
				language={language()}
				setLanguage={setLanguage}
				printVersos={printVersos()}
				setPrintVersos={setPrintVersos}
				onAddCard={fetchAndAddCard}
				isMTGOImporting={isMTGOImporting()}
				onRawListImport={async (rawList) => {
					setIsMTGOImporting(true);
					try {
						const newList = await getNewListFromMTGO(rawList);
						setCardList((prev) => [...prev, ...newList]);
					} finally {
						setIsMTGOImporting(false);
						setImportProgress(null);
					}
				}}
				onDownloadZip={extractZip}
			/>

			<div class="relative p-8 print:p-0 h-full overflow-y-auto bg-mtg-stone-900 print:bg-white print:overflow-visible pages custom-scrollbar">
				<Show 
					when={cardList().value.length > 0} 
					fallback={
						<div class="h-full flex flex-col items-center justify-center text-mtg-stone-700 gap-6">
							<div class="relative w-32 h-32 flex items-center justify-center">
								<div class="absolute inset-0 bg-mtg-gold/5 rounded-full blur-3xl animate-pulse"></div>
								<svg xmlns="http://www.w3.org/2000/svg" class="w-24 h-24 relative z-10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
									<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									<path d="M6.5 17c-1.38 0-2.5 1.12-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5H20V17H6.5z"/>
									<path d="M12 7h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
									<path d="M12 11h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
								</svg>
							</div>
							<div class="flex flex-col items-center gap-1">
								<h2 class="text-2xl font-beleren tracking-[0.2em] uppercase text-mtg-stone-400">Library Empty</h2>
								<p class="text-xs uppercase tracking-widest text-mtg-stone-500 font-bold">Summon your deck to begin</p>
							</div>
						</div>
					}
				>
					<div class="card-grid print:m-auto">
						<For each={cardList().value}>
							{(card, j) => (
								<>
									<div>
										{[0, 1, 2].includes(j() % 9) && <div class="print:mt-5" />}
										<div class={`card-hover-effect rounded-[14px] ${j() === selectedCardIndex() ? 'card-selected' : ''}`}>
											<CardComponent
												id={`card-export-${j()}`}
												card={card}
												onClick={() => {
													setSelectedCardIndex(j());
												}}
												selected={j() == selectedCardIndex()}
											/>
										</div>
										{j() % 9 == 8 && <div class="break-after-page" />}
									</div>
									{j() % 9 != 8 && j() == cardList().value.length - 1
										? [...new Array(8 - (j() % 9))].map((_, i) => (
											<div class="hidden print:block">
												<CardVerso verso={undefined} />
												{i == 7 - (j() % 9) && <div class="break-after-page" />}
											</div>
										))
										: null}

									{printVersos() &&
										(j() % 9 == 8 || j() == cardList().value.length - 1) && (
											<>
												{[...new Array(3)]
													.map((_, i) => i)
													.reverse()
													.map((i) => (
														<div class="hidden print:block">
															<div class="print:mt-5" />
															<CardVerso
																verso={
																	cardList().value[j() - (j() % 9) + i]?.verso
																}
															/>
														</div>
													))}

												{[...new Array(3)]
													.map((_, i) => i)
													.reverse()
													.map((i) => (
														<div class="hidden print:block">
															<CardVerso
																verso={
																	cardList().value[j() - (j() % 9) + i + 3]?.verso
																}
															/>
														</div>
													))}

												{[...new Array(3)]
													.map((_, i) => i)
													.reverse()
													.map((i) => (
														<div class="hidden print:block">
															<CardVerso
																verso={
																	cardList().value[j() - (j() % 9) + i + 6]?.verso
																}
															/>
															{i % 3 == 2 && <div class="break-after-page" />}
														</div>
													))}
											</>
										)}
								</>
							)}
						</For>

						<button
							class="grid place-content-center shadow-xl print:hidden rounded-2xl text-mtg-stone-400 bg-mtg-stone-800 border-2 border-dashed border-mtg-stone-700 hover:border-mtg-gold hover:text-mtg-gold transition-all duration-300"
							onClick={() => {
								const nextIndex = cardList().value.length;
								setCardList((prev) => [...prev, getEmptyCard()]);
								setSelectedCardIndex(nextIndex);
							}}
							style={{
								position: "relative",
								height: "auto",
								width: "var(--card-width)",
								"min-width": "var(--card-width)",
								"max-width": "var(--card-width)",
								"aspect-ratio": "63/88",
								margin: "auto",
								"box-sizing": "content-box",
							}}
						>
							<div class="flex flex-col items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
								<span class="font-beleren uppercase text-sm tracking-widest">Custom Card</span>
							</div>
						</button>
					</div>
				</Show>
			</div>

			<Show when={selectedCard()}>
				{(card) => (
					<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-mtg-black print:hidden">
						<div class="glass max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-3xl shadow-glass border border-mtg-white/10 flex flex-col bg-mtg-black">
							<div class="flex items-center justify-between p-6 border-b border-mtg-white/10 bg-mtg-stone-900">
								<h2 class="text-xl font-beleren tracking-widest uppercase text-mtg-gold">Card Inspector</h2>
								<button 
									onClick={() => setSelectedCardIndex(null)}
									class="p-2 rounded-full bg-mtg-stone-800 hover:bg-mtg-red/20 text-mtg-stone-400 hover:text-mtg-red transition-colors"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
								</button>
							</div>
							
							<div class="overflow-y-auto p-6 flex-1 custom-scrollbar">
								<EditCardForm
									card={card}
									setCard={setSelectedCard}
									onRemoveCard={() => {
										setCardList(
											cardList().value.filter((_, i) => i != selectedCardIndex()),
										);
										setSelectedCardIndex(null);
									}}
									onDuplicateCard={() => {
										setCardList((prev) => [...prev, { ...card() }]);
										setSelectedCardIndex(cardList().value.length);
									}}
									onSetCardDefaultVerso={(url) => {
										setDefaultVerso(url);
									}}
								/>
							</div>
						</div>
					</div>
				)}
			</Show>
		</main>
	);
}

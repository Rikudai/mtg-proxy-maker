import {
	createEffect,
	createResource,
	createSignal, For, untrack,
	Show,
	onMount,
	onCleanup
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import CardComponent from "./components/card/card";
import CardVerso from "./components/card/card-verso";
import EditCardForm from "./components/edit-card-form";
import Sidebar from "./components/sidebar";
import { parseMtgo } from "./services/mtgo-parser";
import { fetchCard, fetchCardsBulk } from "./services/scryfall";
import { Card, getEmptyCard } from "./types/card";
import toast, { Toaster } from "solid-toast";
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CardError } from "./types/error";
import { toastError } from "./services/toaster";

function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}

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

	const [importErrors, setImportErrors] = createSignal<Array<{ cardName: string, quantity: number, message: string }>>([]);
	const [showErrorModal, setShowErrorModal] = createSignal(false);

	const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

	const pages = () => chunkArray(cardList().value, 9);

	const selectedCard = () =>
		selectedCardIndex() !== null
			? cardList().value[selectedCardIndex()!]
			: null;

	const setSelectedCard = (fn: (prev: Card) => Card) => {
		if (selectedCardIndex() == null || selectedCard() == null) return;
		setCardList(selectedCardIndex()!, fn(selectedCard()!));
	};

	const handleDragStart = (e: DragEvent, index: number) => {
		setDraggedIndex(index);
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
		}
	};

	const handleDragOver = (e: DragEvent, targetIndex: number) => {
		e.preventDefault();
		const sourceIndex = draggedIndex();
		
		if (sourceIndex !== null && sourceIndex !== targetIndex) {
			setCardList(produce((list: Card[]) => {
				const [movedItem] = list.splice(sourceIndex, 1);
				list.splice(targetIndex, 0, movedItem);
			}));
			setDraggedIndex(targetIndex);
			setDragOverIndex(targetIndex);
		}
	};

	const handleDragEnd = () => {
		setDraggedIndex(null);
		setDragOverIndex(null);
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		handleDragEnd();
	};

	async function fetchAndAddCard(name: string, variant: number = 0) {
		const placeholderId = `loading-${Date.now()}-${Math.random()}`;
		const placeholder: Card = {
			...getEmptyCard(),
			title: name,
			originalName: name,
			isLoading: true,
			set: placeholderId,
		};

		setCardList(produce((list: Card[]) => {
			list.push(placeholder);
		}));

		try {
			const fetchedCard = await fetchCard(name, language(), variant);
			setCardList(produce((list: Card[]) => {
				const idx = list.findIndex(c => c.set === placeholderId);
				if (idx !== -1) list.splice(idx, 1, fetchedCard);
			}));
		} catch (e) {
			setCardList(produce((list: Card[]) => {
				const idx = list.findIndex(c => c.set === placeholderId);
				if (idx !== -1) list.splice(idx, 1);
			}));
			if (e instanceof CardError) {
				toastError(e);
			}
		}
	}

	async function getNewListFromMTGO(mtgoList: string, onError?: (name: string, message: string) => void) {
		const parsedList = parseMtgo(mtgoList);
		const uniqueNames = Array.from(new Set(parsedList.map(item => item.name)));
		
		const totalCardsToProcess = parsedList.reduce((acc, curr) => acc + (curr.number || 0), 0);
		setImportProgress({ current: 0, total: totalCardsToProcess, cardName: "Iniciando importação em lote..." });

		// Busca todas as cartas únicas em blocos de 50
		const bulkResults = await fetchCardsBulk(uniqueNames, language(), (current, total, cardName) => {
			// O progresso aqui é baseado em nomes únicos, vamos tentar estimar o progresso real ou apenas mostrar o nome
			setImportProgress(prev => ({ 
				current: Math.min(prev?.current || 0, totalCardsToProcess), 
				total: totalCardsToProcess, 
				cardName 
			}));
		});

		// Cria um mapa para busca rápida
		const cardMap = new Map<string, Card>();
		bulkResults.forEach(card => cardMap.set(card.originalName.toLowerCase(), card));

		const successes: Card[] = [];
		let processed = 0;

		for (const item of parsedList) {
			const baseCard = cardMap.get(item.name.toLowerCase());
			
			if (!baseCard) {
				console.error(`Card not found in bulk results: ${item.name}`);
				onError?.(item.name, "Não encontrada");
				processed += item.number || 0;
				continue;
			}

			// Para cada quantidade, cria uma cópia com a variante correta
			for (let i = 0; i < (item.number || 0); i++) {
				processed++;
				setImportProgress({ current: processed, total: totalCardsToProcess, cardName: item.name });

				try {
					// Se for a primeira cópia e for a variante 0 (padrão), usamos o baseCard
					// Caso contrário, buscamos a variante específica (isso ainda requer fetch individual se i > 0, 
					// mas para a maioria das cópias i=0 será o baseCard)
					if (i === 0) {
						successes.push(JSON.parse(JSON.stringify(baseCard)));
					} else {
						// Para cópias adicionais, podemos reutilizar o baseCard se não quisermos variantes diferentes,
						// ou pedir a variante específica se o app suportar artes diferentes por cópia no import.
						// Mantendo a compatibilidade com a lógica original:
						const variantCard = await fetchCard(item.name, language(), i);
						successes.push(variantCard);
					}
				} catch (e) {
					if (e instanceof CardError) onError?.(item.name, e.message);
				}
			}
		}

		return successes;
	}

	async function getCardList(): Promise<Card[]> {
		const urlCardList = url.searchParams.get("cardList");
		localStorage.removeItem("cardList");
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
		setCardList(produce((list: Card[]) => {
			list.forEach((c: any) => { c.lang = lang; });
		}));
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

				const blob = await toPng(node, { pixelRatio: 2, cacheBust: true });
				const base64Data = blob.replace(/^data:image\/png;base64,/, "");

				nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
				const uniqueName = nameCounts[baseName] === 1 ? baseName : `${baseName} ${String(nameCounts[baseName] - 1).padStart(2, '0')}`;
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
			<div class="print:hidden h-full overflow-hidden">
				<Sidebar
					onClearList={() => { setCardList([]); setSelectedCardIndex(null); }}
					language={language()} setLanguage={setLanguage}
					printVersos={printVersos()} setPrintVersos={setPrintVersos}
					onAddCard={fetchAndAddCard}
					isMTGOImporting={isMTGOImporting()}
					onRawListImport={async (rawList) => {
						setIsMTGOImporting(true); setImportErrors([]);
						const totalToImport = parseMtgo(rawList).reduce((acc, curr) => acc + (curr?.number || 0), 0);
						try {
							const newList = await getNewListFromMTGO(rawList, (name, message) => {
								toastError(new CardError(name, message));
								setImportErrors(prev => {
									const existing = prev.find(e => e.cardName === name);
									if (existing) return prev.map(e => e.cardName === name ? { ...e, quantity: e.quantity + 1 } : e);
									return [...prev, { cardName: name, quantity: 1, message }];
								});
							});
							setCardList(produce((list: Card[]) => { newList.forEach(c => list.push(c)); }));
							
							toast.success(`${newList.length}/${totalToImport} Cards imported successfully`, {
								duration: 5000,
								style: {
									background: "#1c1917",
									color: "#fbbf24",
									border: "1px solid rgba(251, 191, 36, 0.2)",
									"font-family": "Beleren",
									"letter-spacing": "0.05em"
								}
							});
							if (importErrors().length > 0) setShowErrorModal(true);
						} finally { setIsMTGOImporting(false); setImportProgress(null); }
					}}
					onDownloadZip={extractZip}
				/>
			</div>

			<div class="relative p-8 print:p-0 h-full overflow-y-auto bg-mtg-stone-900 print:bg-white print:overflow-visible pages custom-scrollbar">
				<Show when={cardList().value.length > 0} fallback={
					<div class="h-full flex flex-col items-center justify-center text-mtg-stone-700 gap-6 print:hidden">
						<div class="relative w-32 h-32 flex items-center justify-center">
							<div class="absolute inset-0 bg-mtg-gold/5 rounded-full blur-3xl animate-pulse"></div>
							<svg xmlns="http://www.w3.org/2000/svg" class="w-24 h-24 relative z-10" viewBox="0 0 24 24" fill="currentColor"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 17c-1.38 0-2.5 1.12-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5H20V17H6.5z"/></svg>
						</div>
						<div class="flex flex-col items-center gap-1">
							<h2 class="text-2xl font-beleren tracking-[0.2em] uppercase text-mtg-stone-400">Library Empty</h2>
							<p class="text-xs uppercase tracking-widest text-mtg-stone-500 font-bold">Summon your deck to begin</p>
						</div>
					</div>
				}>
					<div class="flex flex-col items-center gap-12 print:gap-0 print:block">
						<For each={pages()}>
							{(page, pageIndex) => (
								<div class="page-container relative group/page print:m-0 print:border-none print:shadow-none print:bg-transparent">
									<div class="absolute -top-8 left-0 text-[10px] font-bold uppercase tracking-[0.3em] text-mtg-stone-600 print:hidden">
										Sheet #{pageIndex() + 1}
									</div>
									<div class="card-grid print:m-auto">
										<For each={page}>
											{(card, cardInPageIndex) => {
												const globalIndex = () => pageIndex() * 9 + cardInPageIndex();
												return (
													<div 
														draggable="true"
														onDragStart={(e) => handleDragStart(e, globalIndex())}
														onDragOver={(e) => handleDragOver(e, globalIndex())}
														onDragEnd={handleDragEnd}
														onDrop={handleDrop}
														class={`transition-all duration-150 cursor-grab active:cursor-grabbing
															${draggedIndex() === globalIndex() ? 'z-10 ring-2 ring-mtg-blue/20' : 'opacity-100'}
														`}
													>
														<div class={`card-hover-effect rounded-[14px] ${globalIndex() === selectedCardIndex() ? 'card-selected' : ''}`}>
															<CardComponent
																id={`card-export-${globalIndex()}`}
																card={card}
																onClick={() => setSelectedCardIndex(globalIndex())}
																selected={globalIndex() == selectedCardIndex()}
															/>
														</div>
													</div>
												);
											}}
										</For>
										{pageIndex() === pages().length - 1 && page.length < 9 && (
											<For each={[...new Array(9 - page.length)]}>
												{() => <div class="hidden print:block"><CardVerso verso={undefined} /></div>}
											</For>
										)}
									</div>
									<Show when={printVersos()}>
										<div class="break-before-page" />
										<div class="card-grid print:m-auto">
											{[0, 1, 2].map((rowIndex) => (
												<For each={[2, 1, 0]}>
													{(colIndex) => {
														const card = page[rowIndex * 3 + colIndex];
														return <div class="hidden print:block"><CardVerso verso={card?.verso} /></div>;
													}}
												</For>
											))}
										</div>
									</Show>
									{(pageIndex() < pages().length - 1 || printVersos()) && <div class="break-after-page" />}
								</div>
							)}
						</For>

						<button
							class="grid place-content-center shadow-xl print:hidden rounded-2xl text-mtg-stone-400 bg-mtg-stone-800 border-2 border-dashed border-mtg-stone-700 hover:border-mtg-gold hover:text-mtg-gold transition-all duration-300"
							onClick={() => { const nextIndex = cardList().value.length; setCardList((prev) => [...prev, getEmptyCard()]); setSelectedCardIndex(nextIndex); }}
							style={{ position: "relative", height: "auto", width: "var(--card-width)", "min-width": "var(--card-width)", "max-width": "var(--card-width)", "aspect-ratio": "63/88", margin: "auto", "box-sizing": "content-box" }}
						>
							<div class="flex flex-col items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5v14"/></svg>
								<span class="font-beleren uppercase text-sm tracking-widest">Custom Card</span>
							</div>
						</button>
					</div>
				</Show>
			</div>

			<Show when={selectedCard()}>
				{(card) => (
					<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-mtg-black/80 print:hidden backdrop-blur-sm">
						<div class="glass max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-3xl shadow-glass border border-mtg-white/10 flex flex-col bg-mtg-black">
							<div class="flex items-center justify-between p-6 border-b border-mtg-white/10 bg-mtg-stone-900">
								<h2 class="text-xl font-beleren tracking-widest uppercase text-mtg-gold">Card Inspector</h2>
								<button onClick={() => setSelectedCardIndex(null)} class="p-2 rounded-full bg-mtg-stone-800 hover:bg-mtg-red/20 text-mtg-stone-400 hover:text-mtg-red transition-colors">
									<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6 12 12"/></svg>
								</button>
							</div>
							<div class="overflow-y-auto p-6 flex-1 custom-scrollbar">
								<EditCardForm
									card={card} setCard={setSelectedCard}
									onRemoveCard={() => { setCardList(produce((list: Card[]) => { list.splice(selectedCardIndex()!, 1); })); setSelectedCardIndex(null); }}
									onDuplicateCard={() => { const cardToDuplicate = JSON.parse(JSON.stringify(card())) as Card; setCardList(produce((list: Card[]) => { list.push(cardToDuplicate); })); setSelectedCardIndex(cardList().value.length - 1); }}
									onSetCardDefaultVerso={setDefaultVerso}
								/>
							</div>
						</div>
					</div>
				)}
			</Show>

			<div class="print:hidden">
				<Show when={exportProgress()}>
					{(progress) => (
						<div class="fixed inset-0 z-[100] flex items-center justify-center bg-mtg-black/90">
							<div class="glass rounded-2xl p-8 max-w-lg w-full flex flex-col items-center gap-6 shadow-glass border-mtg-white/10">
								<div class="text-2xl font-beleren tracking-wider text-center text-mtg-white drop-shadow-md">Exporting Cards...</div>
								<div class="w-full relative">
									<div class="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-mtg-black border border-mtg-white/5">
										<div style={{ width: `${(progress().current / progress().total) * 100}%` }} class="flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-mtg-blue to-mtg-green transition-all duration-300 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
									</div>
									<div class="text-xs text-center text-mtg-stone-400 font-medium">{progress().current} of {progress().total} Processed</div>
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
						<div class="fixed inset-0 z-[100] flex items-center justify-center bg-mtg-black/90">
							<div class="glass rounded-2xl p-8 max-w-lg w-full flex flex-col items-center gap-6 shadow-glass border-mtg-white/10">
								<div class="text-2xl font-beleren tracking-wider text-center text-mtg-white drop-shadow-md">Importing Cards...</div>
								<div class="w-full relative">
									<div class="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-mtg-black border border-mtg-white/5">
										<div style={{ width: `${(progress().current / progress().total) * 100}%` }} class="flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-mtg-red to-mtg-gold transition-all duration-300 ease-out shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
									</div>
									<div class="text-xs text-center text-mtg-stone-400 font-medium">{progress().current} of {progress().total} Processed</div>
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

				<Show when={showErrorModal() && importErrors().length > 0}>
					<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowErrorModal(false)}>
						<div class="glass rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-glass border border-mtg-red/30 mx-4" onClick={(e) => e.stopPropagation()}>
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-full bg-mtg-red/20 flex items-center justify-center flex-shrink-0">
									<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-mtg-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
									</svg>
								</div>
								<div>
									<h3 class="font-beleren text-mtg-white tracking-wide">Erros na importação</h3>
									<p class="text-xs text-mtg-stone-400">{importErrors().length} carta(s) não foram encontradas</p>
								</div>
							</div>
							<div class="bg-mtg-stone-950 rounded-xl p-3 max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
								{importErrors().map(e => (
									<div class="flex items-center gap-2 text-sm">
										<span class="text-mtg-red text-xs">✕</span>
										<span class="text-mtg-stone-300 font-bold">{e.quantity}x</span>
										<span class="text-mtg-stone-300">{e.cardName}</span>
										<span class="text-mtg-stone-500 text-xs">— {e.message}</span>
									</div>
								))}
							</div>
							<div class="flex gap-2">
								<button id="copy-errors-btn" class="flex-1 px-4 py-2 rounded-xl bg-mtg-stone-800 hover:bg-mtg-stone-700 text-mtg-stone-200 text-sm font-medium transition-colors" onClick={() => {
									const text = importErrors().map(e => `${e.quantity} ${e.cardName}`).join('\n');
									navigator.clipboard.writeText(text);
									const btn = document.getElementById('copy-errors-btn');
									if (btn) { btn.textContent = '✓ Copiado!'; setTimeout(() => { btn.textContent = 'Copiar lista'; }, 1500); }
								}}>Copiar lista</button>
								<button class="px-4 py-2 rounded-xl bg-mtg-red/20 hover:bg-mtg-red/30 text-mtg-red text-sm font-medium transition-colors" onClick={() => setShowErrorModal(false)}>Fechar</button>
							</div>
						</div>
					</div>
				</Show>
			</div>

			<div class="print:hidden absolute h-0 w-0 overflow-hidden">
				<Toaster position="bottom-right" />
			</div>
		</main>
	);
}

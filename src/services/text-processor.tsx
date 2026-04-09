import { JSX } from "solid-js";
import { symbols } from "../types/symbols";

export function processText(text: string, _lang: string = "en"): JSX.Element {
	// 1. Identify symbols {X}, bold text *text* and italic text _text_
	// Regex matches:
	// Group 1: Symbols like {W}
	// Group 2: Bold text inside asterisks like *Flying*
	// Group 3: Italic text inside underscores like _Coven_
	const combinedRegex = /({[^}]+})|\*(.*?)\*|_(.*?)_/g;

	const parts: string[] = [];
	let lastIndex = 0;
	let match;

	while ((match = combinedRegex.exec(text)) !== null) {
		// Add text before the match
		if (match.index > lastIndex) {
			parts.push(text.substring(lastIndex, match.index));
		}

		if (match[1]) {
			// It's a symbol
			parts.push(match[1]);
		} else if (match[2]) {
			// It's bold text – we've captured the content without asterisks
			parts.push(`__BOLD__${match[2]}`);
		} else if (match[3]) {
			// It's italic text – we've captured the content without underscores
			parts.push(`__ITALIC__${match[3]}`);
		}
		
		lastIndex = combinedRegex.lastIndex;
	}

	// Add remaining text
	if (lastIndex < text.length) {
		parts.push(text.substring(lastIndex));
	}

	return (
		<>
			{parts.map((part) => {
				// Check if it's a symbol
				if (part.startsWith("{") && part.endsWith("}")) {
					const symbolName = part.slice(1, -1).replace("/", "");
					if (symbolName in symbols) {
						return (
							<img
								style={{
									width: "2.5mm",
									transform: "translateY(2px)",
									margin: "0 0.1mm",
									display: "initial",
									"vertical-align": "initial",
								}}
								src={symbols[symbolName as keyof typeof symbols]}
							/>
						);
					}
					return part;
				}

				// Check if it's a bold part
				if (part.startsWith("__BOLD__")) {
					const content = part.replace("__BOLD__", "");
					return <strong style={{ "font-weight": 700 }}>{content}</strong>;
				}

				// Check if it's an italic part
				if (part.startsWith("__ITALIC__")) {
					const content = part.replace("__ITALIC__", "");
					return <em style={{ "font-style": "italic" }}>{content}</em>;
				}

				// Otherwise, plain text
				return part;
			})}
		</>
	);
}

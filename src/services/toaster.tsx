import solidToast from 'solid-toast';
import { CardError } from '../types/error';

export function toastError(error: CardError) {
	const toastId = solidToast.custom(
		<div role="alert" class="alert cursor-pointer w-96 alert-error" onClick={(() => solidToast.dismiss(toastId))}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<div>
				<h3 class="font-bold">{error.cardName}</h3>
				<div class="text-xs">{error.message}</div>
			</div>
		</div>, {
		duration: 1000
	})
}

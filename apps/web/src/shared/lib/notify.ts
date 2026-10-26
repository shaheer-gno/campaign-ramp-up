import Swal from 'sweetalert2';

const base = {
  confirmButtonColor: '#0f6b4c',
  cancelButtonColor: '#6b7280',
};

export async function notifySuccess(title: string, text?: string) {
  await Swal.fire({ ...base, icon: 'success', title, text });
}

export async function notifyError(title: string, text?: string) {
  await Swal.fire({ ...base, icon: 'error', title, text });
}

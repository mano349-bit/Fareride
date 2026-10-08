export async function withDeadline(operation, milliseconds = 20000) {
 let timer;
 try {
  return await Promise.race([operation, new Promise((_, reject) => {
   timer = setTimeout(() => { const error = new Error('Your sign-in is saved, but the account check timed out. Please check your connection and try again.'); error.code = 'fareride/profile-timeout'; reject(error); }, milliseconds);
  })]);
 } finally { clearTimeout(timer); }
}

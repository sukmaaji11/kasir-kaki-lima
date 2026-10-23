import 'dotenv/config';
import { auth } from '../src/lib/auth/auth';

console.log(
  'API tersedia:',
  Object.keys(auth.api).filter((key) =>
    /signUpEmail|signInUsername/i.test(key),
  ),
);

console.log('Internal adapter tersedia:', Boolean(auth.$context));


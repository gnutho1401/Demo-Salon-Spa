const bcrypt = require('bcryptjs');
const hash = '$2b$10$W4lDysNRqW7yEWamnyZT7Oakp3DRaiP58du5bPQP/Kw2D89l38mJ6';
(async()=>{
  const isMatch = await bcrypt.compare('123456', hash);
  console.log("Is password '123456' a match?", isMatch);
  process.exit(0);
})();

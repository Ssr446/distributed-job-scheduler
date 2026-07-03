const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

const files = walkSync(path.join(__dirname, 'src'));

for (const file of files) {
  if (file.endsWith('.ts')) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Fix req.params.* type error by casting to string
    const paramRegex = /req\.params\.([a-zA-Z0-9_]+)(?!\s*as\s*string)/g;
    if (paramRegex.test(content) && file.includes('controller.ts')) {
      content = content.replace(paramRegex, '(req.params.$1 as string)');
      changed = true;
    }

    if (file.includes('jobs.routes.ts')) {
      content = content.replace('validate(createJobSchema)', 'validate({ body: createJobSchema as any })');
      content = content.replace('validate(batchCreateJobSchema)', 'validate({ body: batchCreateJobSchema as any })');
      changed = true;
    }

    if (file.includes('jobs.service.ts')) {
      content = content.replace(/AppError\.notFound\('Job',[^)]+\)/g, "AppError.notFound('Job')");
      changed = true;
    }

    if (file.includes('auth.service.ts')) {
      content = content.replace(/expiresIn: env.JWT_EXPIRES_IN,/g, "expiresIn: env.JWT_EXPIRES_IN as any,");
      content = content.replace(/expiresIn: env.JWT_REFRESH_EXPIRES_IN,/g, "expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,");
      changed = true;
    }
    
    if (file.includes('jobs.controller.ts')) {
       // TS7030 not all code paths return a value
       if (content.includes('return res.status(400)')) {
          content = content.replace(/return res\.status\(400\)\.json\(([^)]+)\);/g, "res.status(400).json($1);\n      return;");
          changed = true;
       }
    }

    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
}

export function subjectIconMarkup(config,name){
  const normalized=name.replaceAll('’',"'");
  const asset=config.subjectIcons?.[name]||config.subjectIcons?.[normalized];
  if(!asset||!/^assets\/subjects\/[a-z][a-z0-9-]*\.svg$/.test(asset))return '';
  return '<span class="subject-symbol" aria-hidden="true"><img class="subject-icon" src="'+asset+'" alt="" width="40" height="40" decoding="async" draggable="false"></span>';
}

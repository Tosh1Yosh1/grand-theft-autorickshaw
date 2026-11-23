import GUI from 'lil-gui';

let gui: GUI | null = null;
const folders = new Map<string, GUI>();

/** The one lil-gui instance. Hidden until ` is pressed. */
export function debugGui(): GUI {
  if (!gui) {
    gui = new GUI({ title: 'Bhaukaal Debug (`)' });
    gui.domElement.style.zIndex = '10';
    gui.hide();
  }
  return gui;
}

/** Get or create a named top-level folder, so any system can add its own tunables. */
export function debugFolder(name: string, closed = true): GUI {
  let f = folders.get(name);
  if (!f) {
    f = debugGui().addFolder(name);
    if (closed) f.close();
    folders.set(name, f);
  }
  return f;
}

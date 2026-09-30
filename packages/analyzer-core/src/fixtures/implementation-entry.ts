interface Runner {
  run(): number;
}

class ClassRunner implements Runner {
  run(): number {
    return 1;
  }
}

type Handler = {
  handle: () => number;
};

const objectHandler: Handler = {
  handle: () => 2,
};

interface Unimplemented {
  absent(): void;
}

export { ClassRunner, objectHandler };

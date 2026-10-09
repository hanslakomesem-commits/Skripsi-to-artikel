import {WebWorkerMLCEngineHandler} from './vendor/webllm.js';
const handler=new WebWorkerMLCEngineHandler();
self.onmessage=event=>handler.onmessage(event);

document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL ELEMENTS & CONSTANTS ---
    const form = get('kube-form');
    const yamlOutput = get('yaml-output');
    
    const K8S_DOCS = {
        initContainers: "https://k8s.io/docs/concepts/workloads/pods/init-containers/",
        probes: "https://k8s.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/",
        // ... (other doc URLs)
    };

    // --- UTILITY FUNCTIONS ---
    function get(id) { return document.getElementById(id); }
    function getAll(selector, parent = document) { return parent.querySelectorAll(selector); }
    const ckadComment = (text, docUrlKey) => {
        if (!get('ckad-mode-toggle').checked) return '';
        const url = K8S_DOCS[docUrlKey] || '';
        const docLine = url ? `\n# Doc: ${url}` : '';
        return `\n# ${text}${docLine}`;
    };

    // --- DYNAMIC UI LOGIC ---
    function addDynamicItem(type) {
        const templateIdMap = {
            labels: 'key-value-template', nodeSelector: 'key-value-template', env: 'key-value-template',
            command: 'single-value-template', args: 'single-value-template', imagePullSecrets: 'single-value-template',
            volume: 'volume-template', volumeMount: 'volumeMount-template',
            envFrom: 'envFrom-template', initContainers: 'initContainer-template'
        };
        const templateId = templateIdMap[type];
        if (!templateId) return;

        const template = get(templateId).content.cloneNode(true);
        const listContainer = get(`${type}-list`);
        if (listContainer) {
            listContainer.appendChild(template);
        }
        if (type === 'volume') updateVolumeOptions(listContainer.lastElementChild.querySelector('.item-type'));
        if (type === 'volumeMount') updateVolumeMountOptions();
    }

    function removeDynamicItem(element) {
        const item = element.closest('.dynamic-list-item');
        if (item) {
            const isVolume = item.parentElement.id === 'volume-list';
            item.remove();
            if (isVolume) updateVolumeMountOptions();
        }
    }
    
    function updateVolumeOptions(selectElement) {
        const container = selectElement.closest('.dynamic-list-item').querySelector('.volume-options');
        container.innerHTML = '';
        const type = selectElement.value;
        if (type === 'configMap' || type === 'secret' || type === 'persistentVolumeClaim') {
            const resourceName = type === 'persistentVolumeClaim' ? 'pvc' : type;
            container.innerHTML = `<div class="form-group" style="margin-top:10px;"><label>${type} Name <span class="notice">(注意: 事前に${type}の作成が必要)</span></label><input type="text" class="${resourceName}-name" placeholder="Name of existing ${type}"></div>`;
        }
    }

    function updateVolumeMountOptions() {
        const definedVolumes = Array.from(getAll('#volume-list .item-name')).map(input => input.value).filter(Boolean);
        getAll('#volumeMount-list .item-name').forEach(select => {
            const currentSelection = select.value;
            select.innerHTML = '<option value="">-- Select a Volume --</option>';
            definedVolumes.forEach(volName => {
                const option = document.createElement('option');
                option.value = volName; option.textContent = volName;
                if (volName === currentSelection) option.selected = true;
                select.appendChild(option);
            });
        });
    }

    function initializeProbes() {
        const container = get('probe-container');
        if (!container) return;
        container.innerHTML = '';
        ['Liveness', 'Readiness', 'Startup'].forEach(probeName => {
            const template = get('probe-template').content.cloneNode(true);
            const item = template.querySelector('.probe-item');
            item.dataset.probeName = probeName.toLowerCase();
            item.querySelector('.probe-label').textContent = `${probeName} Probe`;
            container.appendChild(template);
        });
    }

    function updateProbeOptions(selectElement) {
        const container = selectElement.closest('.probe-item').querySelector('.probe-options');
        container.innerHTML = '';
        const type = selectElement.value;
        if (type === 'httpGet') container.innerHTML = `<div class="sub-form-group"><input type="text" class="probe-http-path" placeholder="Path (e.g., /healthz)"><input type="number" class="probe-http-port" placeholder="Port (e.g., 8080)"></div>`;
        else if (type === 'tcpSocket') container.innerHTML = `<input type="number" class="probe-tcp-port" placeholder="Port (e.g., 8080)">`;
        else if (type === 'exec') container.innerHTML = `<input type="text" class="probe-exec-command" placeholder="Command (e.g., cat,/tmp/healthy)">`;
    }
    
    // --- STATE COLLECTION ---
    function collectState() {
        const getVal = id => get(id)?.value;
        const getKv = id => Array.from(getAll(`#${id} .key-value-item`)).map(i => ({ key: i.querySelector('.item-key')?.value, value: i.querySelector('.item-value')?.value })).filter(i => i.key);
        const getSingle = id => Array.from(getAll(`#${id} .dynamic-list-item`)).map(i => i.querySelector('.item-value')?.value).filter(Boolean);
        
        return {
            podName: getVal('podName'), namespace: getVal('namespace'), labels: getKv('labels-list'),
            serviceAccountName: getVal('serviceAccountName'), nodeSelector: getKv('nodeSelector-list'),
            restartPolicy: getVal('restartPolicy'), imagePullSecrets: getSingle('imagePullSecrets-list').map(s => ({name: s})),
            volumes: Array.from(getAll('#volume-list .dynamic-list-item')).map(item => {
                const type = item.querySelector('.item-type')?.value;
                const vol = { name: item.querySelector('.item-name')?.value, type: type };
                if (type === 'configMap') vol.sourceName = item.querySelector('.configMap-name')?.value;
                if (type === 'secret') vol.sourceName = item.querySelector('.secret-name')?.value;
                if (type === 'persistentVolumeClaim') vol.sourceName = item.querySelector('.pvc-name')?.value;
                return vol;
            }).filter(v => v.name),
            initContainers: Array.from(getAll('#initContainers-list .dynamic-list-item')).map(c => ({ name: c.querySelector('.item-name')?.value, image: c.querySelector('.item-image')?.value })).filter(c => c.name && c.image),
            container: {
                name: getVal('containerName'), image: getVal('imageName'), command: getSingle('command-list'), args: getSingle('args-list'),
                env: getKv('env-list'),
                envFrom: Array.from(getAll('#envFrom-list .envFrom-item')).map(e => ({ type: e.querySelector('.item-type')?.value, name: e.querySelector('.item-name')?.value })).filter(e => e.name),
                probes: Array.from(getAll('.probe-item')).map(p => {
                    const probe = { name: p.dataset.probeName, type: p.querySelector('.probe-type')?.value, initialDelaySeconds: p.querySelector('.probe-initialDelaySeconds')?.value, periodSeconds: p.querySelector('.probe-periodSeconds')?.value, timeoutSeconds: p.querySelector('.probe-timeoutSeconds')?.value, failureThreshold: p.querySelector('.probe-failureThreshold')?.value };
                    if (probe.type === 'httpGet') { probe.path = p.querySelector('.probe-http-path')?.value; probe.port = p.querySelector('.probe-http-port')?.value; } 
                    else if (probe.type === 'tcpSocket') { probe.port = p.querySelector('.probe-tcp-port')?.value; } 
                    else if (probe.type === 'exec') { const cmdStr = p.querySelector('.probe-exec-command')?.value; if (cmdStr) probe.command = cmdStr.split(',').map(c => c.trim()).filter(Boolean); }
                    return probe;
                }).filter(p => p.type !== 'none'),
                volumeMounts: Array.from(getAll('#volumeMount-list .dynamic-list-item')).map(item => ({ name: item.querySelector('.item-name')?.value, mountPath: item.querySelector('.item-mountPath')?.value })).filter(vm => vm.name && vm.mountPath),
                lifecycle: { postStart: getVal('lifecycle_postStart'), preStop: getVal('lifecycle_preStop') },
            },
        };
    }

    // --- YAML GENERATION ---
    function generateYaml() {
        try {
            const state = collectState();
            let yaml = `apiVersion: v1\nkind: Pod`;
            // METADATA
            yaml += ckadComment('PodやServiceなどのAPIオブジェクトを識別するためのデータ', 'metadata');
            yaml += `\nmetadata:\n  name: ${state.podName}`;
            if (state.namespace) yaml += `\n  namespace: ${state.namespace}`;
            if (state.labels.length > 0) { yaml += `\n  labels:`; state.labels.forEach(l => { yaml += `\n    ${l.key}: ${l.value}`; }); }
            // SPEC
            yaml += ckadComment('Podの望ましい状態を定義するSpec', 'spec');
            yaml += `\nspec:`;
            if (state.serviceAccountName) yaml += `\n  serviceAccountName: ${state.serviceAccountName}`;
            if (state.restartPolicy !== 'Always') yaml += `\n  restartPolicy: ${state.restartPolicy}`;
            if (state.imagePullSecrets.length > 0) { yaml += ckadComment('プライベートレジストリからイメージをプルするためのSecret', 'imagePullSecrets') + `\n  imagePullSecrets:`; state.imagePullSecrets.forEach(s => { yaml += `\n  - name: ${s.name}`; });}
            if (state.nodeSelector.length > 0) { yaml += `\n  nodeSelector:`; state.nodeSelector.forEach(s => { yaml += `\n    ${s.key}: ${s.value}`; }); }
            if (state.volumes.length > 0) {
                 yaml += `\n  volumes:`;
                 state.volumes.forEach(v => {
                    yaml += `\n  - name: ${v.name}`;
                    if (v.type === 'emptyDir') yaml += `\n    emptyDir: {}`;
                    else if (v.type === 'configMap' && v.sourceName) yaml += `\n    configMap:\n      name: ${v.sourceName}`;
                    else if (v.type === 'secret' && v.sourceName) yaml += `\n    secret:\n      secretName: ${v.sourceName}`;
                    else if (v.type === 'persistentVolumeClaim' && v.sourceName) yaml += `\n    persistentVolumeClaim:\n      claimName: ${v.sourceName}`;
                });
            }
            // INIT CONTAINERS
             if(state.initContainers.length > 0) {
                 yaml += ckadComment('メインコンテナの前に実行される初期化コンテナ', 'initContainers');
                 yaml += `\n  initContainers:`;
                 state.initContainers.forEach(ic => { yaml += `\n  - name: ${ic.name}\n    image: ${ic.image}`; });
             }
            // CONTAINERS
            const c = state.container;
            yaml += ckadComment('Pod内で実行されるコンテナのリスト (最低1つは必須)', 'containers');
            yaml += `\n  - name: ${c.name}\n    image: ${c.image}`;
            if (c.command.length > 0) yaml += `\n    command: [${c.command.map(cmd => `"${cmd}"`).join(', ')}]`;
            if (c.args.length > 0) yaml += `\n    args: [${c.args.map(arg => `"${arg}"`).join(', ')}]`;
            if (c.env.length > 0 || c.envFrom.length > 0) {
                yaml += `\n    env:`;
                if(c.env.length > 0) c.env.forEach(env => { yaml += `\n    - name: ${env.key}\n      value: "${env.value}"`; });
                if(c.envFrom.length > 0) {
                    yaml += `\n    envFrom:`;
                    c.envFrom.forEach(ef => { yaml += `\n    - ${ef.type}:\n        name: ${ef.name}`; });
                }
            }
            if (c.probes.length > 0) {
                 c.probes.forEach(p => {
                    let probeDef = '';
                    if(p.type === 'httpGet') probeDef += `\n      httpGet:\n        path: "${p.path || '/'}"\n        port: ${parseInt(p.port)}`;
                    else if(p.type === 'tcpSocket') probeDef += `\n      tcpSocket:\n        port: ${parseInt(p.port)}`;
                    else if(p.type === 'exec' && p.command && p.command.length > 0) probeDef += `\n      exec:\n        command: [${p.command.map(cmd => `"${cmd}"`).join(', ')}]`;
                    else return;
                    if(p.initialDelaySeconds) probeDef += `\n      initialDelaySeconds: ${parseInt(p.initialDelaySeconds)}`;
                    if(p.periodSeconds) probeDef += `\n      periodSeconds: ${parseInt(p.periodSeconds)}`;
                    if(p.timeoutSeconds) probeDef += `\n      timeoutSeconds: ${parseInt(p.timeoutSeconds)}`;
                    if(p.failureThreshold) probeDef += `\n      failureThreshold: ${parseInt(p.failureThreshold)}`;
                    yaml += ckadComment(`${p.name}Probe: コンテナのヘルスチェック`, 'probes') + `\n    ${p.name}Probe:` + probeDef;
                 });
            }
             if (c.volumeMounts.length > 0) { yaml += `\n    volumeMounts:`; c.volumeMounts.forEach(vm => { yaml += `\n    - name: ${vm.name}\n      mountPath: "${vm.mountPath}"`; }); }
             if (c.lifecycle.postStart || c.lifecycle.preStop) {
                 yaml += `\n    lifecycle:`;
                 if(c.lifecycle.postStart) yaml += `\n      postStart:\n        exec:\n          command: [${c.lifecycle.postStart.split(',').map(s=>`"${s.trim()}"`).join(', ')}]`;
                 if(c.lifecycle.preStop) yaml += `\n      preStop:\n        exec:\n          command: [${c.lifecycle.preStop.split(',').map(s=>`"${s.trim()}"`).join(', ')}]`;
             }
            yamlOutput.value = yaml;
            get('deploy-command').textContent = `kubectl apply -f ${state.podName}.yaml`;
            localStorage.setItem('podGeneratorState', JSON.stringify(state));
            validateForm();
        } catch (error) { yamlOutput.value = `エラーが発生しました:\n${error.stack}`; console.error("YAML Generation Error:", error); }
    }
    
    function validateForm() { getAll('input[required]').forEach(input => { input.classList.toggle('invalid', input.value.trim() === ''); }); }
    
    function setupEventListeners() {
        form.addEventListener('input', generateYaml);
        form.addEventListener('change', (e) => {
            const target = e.target;
            if (target.matches('select, input[type=checkbox]')) {
                if (target.classList.contains('probe-type')) {
                    updateProbeOptions(target);
                } else if (target.classList.contains('item-type')) {
                    updateVolumeOptions(target);
                }
                generateYaml();
            }
        });

        form.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const action = button.dataset.action;
            if (action === 'add') addDynamicItem(button.dataset.type);
            if (action === 'remove') removeDynamicItem(button);
            generateYaml();
        });

        get('copy-yaml-btn').addEventListener('click', () => { navigator.clipboard.writeText(yamlOutput.value).then(() => alert('Copied!')); });
        get('save-yaml-btn').addEventListener('click', () => {
            const filename = (get('podName').value || 'pod') + '.yaml';
            const blob = new Blob([yamlOutput.value], { type: 'text/yaml' });
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
        });
        get('reset-form-btn').addEventListener('click', () => { if(confirm('フォームの全内容をリセットしますか？')) { localStorage.removeItem('podGeneratorState'); window.location.reload(); } });
        
        const resetAndLoad = (loader) => { form.reset(); getAll('.dynamic-list').forEach(l => l.innerHTML = ''); initializeProbes(); loader(); generateYaml(); };
        
        get('load-nginx-sample').addEventListener('click', () => resetAndLoad(() => {
            get('podName').value = 'nginx-sample-pod';
            addDynamicItem('labels'); const l = get('labels-list').lastElementChild; l.querySelector('.item-key').value = 'app'; l.querySelector('.item-value').value = 'my-nginx';
            get('containerName').value = 'nginx-container'; get('imageName').value = 'nginx:1.27.1';
            alert('Nginx Podのサンプルを読み込みました。');
        }));
        
        get('load-ubuntu-sample').addEventListener('click', () => resetAndLoad(() => {
            get('podName').value = 'ubuntu-sleeper';
            get('containerName').value = 'ubuntu-container'; get('imageName').value = 'ubuntu:latest';
            addDynamicItem('command'); get('command-list').lastElementChild.querySelector('.item-value').value = 'sleep';
            addDynamicItem('args'); get('args-list').lastElementChild.querySelector('.item-value').value = 'infinity';
            alert('Ubuntu sleeper Podのサンプルを読み込みました。');
        }));
    }

    // --- INITIALIZATION ---
    initializeProbes();
    setupEventListeners();
    // A full applyStateToForm function would be needed for complete restoration.
    generateYaml();
});
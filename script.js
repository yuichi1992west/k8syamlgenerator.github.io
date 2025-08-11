document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL ELEMENTS ---
    const form = document.getElementById('kube-form');
    const yamlOutput = document.getElementById('yaml-output');
    const deployCommand = document.getElementById('deploy-command');

    const K8S_DOCS = {
        metadata: "https://k8s.io/docs/concepts/overview/working-with-objects/kubernetes-objects/",
        labels: "https://k8s.io/docs/concepts/overview/working-with-objects/labels/",
        annotations: "https://k8s.io/docs/concepts/overview/working-with-objects/annotations/",
        serviceAccountName: "https://k8s.io/docs/tasks/configure-pod-container/configure-service-account/",
        restartPolicy: "https://k8s.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy",
        nodeSelector: "https://k8s.io/docs/concepts/scheduling-eviction/assign-pod-node/#nodeselector",
        containers: "https://k8s.io/docs/concepts/workloads/pods/#containers",
        command: "https://k8s.io/docs/tasks/inject-data-application/define-command-argument-container/",
        resources: "https://k8s.io/docs/concepts/configuration/manage-resources-containers/",
        probes: "https://k8s.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/",
        volumes: "https://k8s.io/docs/concepts/storage/volumes/",
        volumeMounts: "https://k8s.io/docs/concepts/storage/volumes/#using-a-volume",
        securityContext: "https://k8s.io/docs/tasks/configure-pod-container/security-context/"
    };

    // --- UTILITY FUNCTIONS ---
    const get = (id) => document.getElementById(id);
    const getAll = (selector) => document.querySelectorAll(selector);

    // Indent helper
    const indent = (str, count = 2) => str.split('\n').map(line => ' '.repeat(count) + line).join('\n');

    // CKAD mode comment helper
    const ckadComment = (text, docUrlKey) => {
        const ckadMode = get('ckad-mode-toggle').checked;
        if (!ckadMode) return '';
        const url = K8S_DOCS[docUrlKey] || '';
        const docLine = url ? `\n# Doc: ${url}` : '';
        return `\n# ${text}${docLine}`;
    };

    // --- DYNAMIC UI LOGIC ---
    function addDynamicItem(type) {
        const templateId = {
            labels: 'key-value-template',
            annotations: 'key-value-template',
            nodeSelector: 'key-value-template',
            command: 'single-value-template',
            args: 'single-value-template',
            volume: 'volume-template',
            volumeMount: 'volumeMount-template'
        }[type];
        
        const template = get(templateId).content.cloneNode(true);
        get(`${type}-list`).appendChild(template);

        if (type === 'volume') updateVolumeMountOptions();
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
        let notice = '';
        let resourceName = '';

        if (type === 'configMap') { notice = 'ConfigMap'; resourceName = 'configMap'; }
        if (type === 'secret') { notice = 'Secret'; resourceName = 'secret'; }
        if (type === 'persistentVolumeClaim') { notice = 'PersistentVolumeClaim'; resourceName = 'pvc'; }
        
        if(notice) {
            container.innerHTML = `<div class="form-group" style="margin-top:10px;">
                <label>${notice} Name <span class="notice">(注意: 事前に${notice}の作成が必要)</span></label>
                <input type="text" class="${resourceName}-name" placeholder="Name of existing ${notice}">
            </div>`;
        }
    }

    function updateVolumeMountOptions() {
        const definedVolumes = Array.from(getAll('#volume-list .item-name')).map(input => input.value).filter(Boolean);
        getAll('#volumeMount-list .item-name').forEach(select => {
            const currentSelection = select.value;
            select.innerHTML = '<option value="">-- Select a Volume --</option>';
            definedVolumes.forEach(volName => {
                const option = document.createElement('option');
                option.value = volName;
                option.textContent = volName;
                if (volName === currentSelection) option.selected = true;
                select.appendChild(option);
            });
        });
    }

    function initializeProbes() {
        const container = get('probe-container');
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
        if (type === 'httpGet') {
            container.innerHTML = `<div class="sub-form-group"><input type="text" class="probe-http-path" placeholder="Path (e.g., /healthz)"><input type="number" class="probe-http-port" placeholder="Port (e.g., 8080)"></div>`;
        } else if (type === 'tcpSocket') {
            container.innerHTML = `<input type="number" class="probe-tcp-port" placeholder="Port (e.g., 8080)">`;
        } else if (type === 'exec') {
            container.innerHTML = `<input type="text" class="probe-exec-command" placeholder="Command (e.g., cat,/tmp/healthy)">`;
        }
    }

    // --- STATE COLLECTION ---
    function collectState() {
        const getKeyValuePairs = (id) => Array.from(getAll(`#${id} .dynamic-list-item`)).map(item => ({
            key: item.querySelector('.item-key').value,
            value: item.querySelector('.item-value').value
        })).filter(i => i.key);
        
        const getSingleValues = (id) => Array.from(getAll(`#${id} .item-value`)).map(i => i.value).filter(Boolean);

        const state = {
            podName: get('podName').value || 'my-pod',
            namespace: get('namespace').value,
            labels: getKeyValuePairs('labels-list'),
            annotations: getKeyValuePairs('annotations-list'),
            serviceAccountName: get('serviceAccountName').value,
            nodeSelector: getKeyValuePairs('nodeSelector-list'),
            restartPolicy: get('restartPolicy').value,
            podSecurityContext: {
                runAsUser: get('pod_sc_runAsUser').value,
                runAsGroup: get('pod_sc_runAsGroup').value,
                fsGroup: get('pod_sc_fsGroup').value,
            },
            container: {
                name: get('containerName').value || 'main-container',
                image: get('imageName').value || 'nginx',
                command: getSingleValues('command-list'),
                args: getSingleValues('args-list'),
                resources: {
                    requests: { cpu: get('res_req_cpu').value, memory: get('res_req_mem').value },
                    limits: { cpu: get('res_lim_cpu').value, memory: get('res_lim_mem').value },
                },
                probes: Array.from(getAll('.probe-item')).map(p => {
                    const probe = {
                        name: p.dataset.probeName,
                        type: p.querySelector('.probe-type').value,
                        initialDelaySeconds: p.querySelector('.probe-initialDelaySeconds').value,
                        periodSeconds: p.querySelector('.probe-periodSeconds').value,
                        timeoutSeconds: p.querySelector('.probe-timeoutSeconds').value,
                        failureThreshold: p.querySelector('.probe-failureThreshold').value,
                    };
                    if (probe.type === 'httpGet') {
                        probe.path = p.querySelector('.probe-http-path')?.value;
                        probe.port = p.querySelector('.probe-http-port')?.value;
                    } else if (probe.type === 'tcpSocket') {
                        probe.port = p.querySelector('.probe-tcp-port')?.value;
                    } else if (probe.type === 'exec') {
                        probe.command = p.querySelector('.probe-exec-command')?.value.split(',').map(c => c.trim());
                    }
                    return probe;
                }).filter(p => p.type !== 'none'),
                 volumeMounts: Array.from(getAll('#volumeMount-list .dynamic-list-item')).map(item => ({
                    name: item.querySelector('.item-name').value,
                    mountPath: item.querySelector('.item-mountPath').value
                })).filter(vm => vm.name && vm.mountPath),
            },
             volumes: Array.from(getAll('#volume-list .dynamic-list-item')).map(item => {
                const type = item.querySelector('.item-type').value;
                const vol = { name: item.querySelector('.item-name').value, type: type };
                if (type === 'configMap') vol.sourceName = item.querySelector('.configMap-name')?.value;
                if (type === 'secret') vol.sourceName = item.querySelector('.secret-name')?.value;
                if (type === 'persistentVolumeClaim') vol.sourceName = item.querySelector('.pvc-name')?.value;
                return vol;
            }).filter(v => v.name),
        };
        return state;
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
            if (state.labels.length > 0) {
                yaml += ckadComment('オブジェクトを整理・選択するためのKey-Valueペア', 'labels');
                yaml += `\n  labels:`;
                state.labels.forEach(l => { yaml += `\n    ${l.key}: ${l.value}`; });
            }
            if (state.annotations.length > 0) {
                yaml += ckadComment('ツールなどが利用する、識別目的ではない任意のメタデータ', 'annotations');
                yaml += `\n  annotations:`;
                state.annotations.forEach(a => { yaml += `\n    ${a.key}: ${a.value}`; });
            }

            // SPEC
            yaml += ckadComment('Podの望ましい状態を定義するSpec', 'spec');
            yaml += `\nspec:`;
            if (state.serviceAccountName) {
                yaml += ckadComment('PodがAPIサーバーと通信する際に使用するサービスアカウント', 'serviceAccountName');
                yaml += `\n  serviceAccountName: ${state.serviceAccountName}`;
            }
            if (state.restartPolicy !== 'Always') {
                 yaml += ckadComment('Pod内のコンテナが終了した際の再起動ポリシー (Always, OnFailure, Never)', 'restartPolicy');
                 yaml += `\n  restartPolicy: ${state.restartPolicy}`;
            }
            const psc = state.podSecurityContext;
            if (Object.values(psc).some(Boolean)) {
                 yaml += ckadComment('Pod全体に適用されるセキュリティ設定', 'securityContext');
                 yaml += `\n  securityContext:`;
                 if (psc.runAsUser) yaml += `\n    runAsUser: ${psc.runAsUser}`;
                 if (psc.runAsGroup) yaml += `\n    runAsGroup: ${psc.runAsGroup}`;
                 if (psc.fsGroup) yaml += `\n    fsGroup: ${psc.fsGroup}`;
            }
            if (state.nodeSelector.length > 0) {
                yaml += ckadComment('Podを特定のラベルを持つノードにスケジュールするためのセレクタ', 'nodeSelector');
                yaml += `\n  nodeSelector:`;
                state.nodeSelector.forEach(s => { yaml += `\n    ${s.key}: ${s.value}`; });
            }

            // VOLUMES
            if (state.volumes.length > 0) {
                 yaml += ckadComment('コンテナが利用できるストレージボリュームのリスト', 'volumes');
                 yaml += `\n  volumes:`;
                 state.volumes.forEach(v => {
                    yaml += `\n  - name: ${v.name}`;
                    if (v.type === 'emptyDir') yaml += `\n    emptyDir: {}`;
                    if (v.type === 'configMap') yaml += `\n    configMap:\n      name: ${v.sourceName}`;
                    if (v.type === 'secret') yaml += `\n    secret:\n      secretName: ${v.sourceName}`;
                    if (v.type === 'persistentVolumeClaim') yaml += `\n    persistentVolumeClaim:\n      claimName: ${v.sourceName}`;
                });
            }

            // CONTAINERS
            const c = state.container;
            yaml += ckadComment('Pod内で実行されるコンテナのリスト (最低1つは必須)', 'containers');
            yaml += `\n  containers:\n  - name: ${c.name}\n    image: ${c.image}`;
            if (c.command.length > 0) {
                yaml += ckadComment('コンテナのデフォルトENTRYPOINTを上書き', 'command');
                yaml += `\n    command: [${c.command.map(cmd => `"${cmd}"`).join(', ')}]`;
            }
             if (c.args.length > 0) {
                yaml += ckadComment('コンテナのデフォルトCMDを上書き', 'command');
                yaml += `\n    args: [${c.args.map(arg => `"${arg}"`).join(', ')}]`;
            }
            const res = c.resources;
            if (Object.values(res.requests).some(Boolean) || Object.values(res.limits).some(Boolean)) {
                 yaml += ckadComment('コンテナが要求/使用制限されるリソース量', 'resources');
                 yaml += `\n    resources:`;
                 if (Object.values(res.requests).some(Boolean)) {
                     yaml += `\n      requests:`;
                     if(res.requests.cpu) yaml += `\n        cpu: "${res.requests.cpu}"`;
                     if(res.requests.memory) yaml += `\n        memory: "${res.requests.memory}"`;
                 }
                  if (Object.values(res.limits).some(Boolean)) {
                     yaml += `\n      limits:`;
                     if(res.limits.cpu) yaml += `\n        cpu: "${res.limits.cpu}"`;
                     if(res.limits.memory) yaml += `\n        memory: "${res.limits.memory}"`;
                 }
            }

            // PROBES
            if (c.probes.length > 0) {
                 c.probes.forEach(p => {
                    yaml += ckadComment(`${p.name}Probe: コンテナのヘルスチェック`, 'probes');
                    yaml += `\n    ${p.name}Probe:`;
                    let probeYaml = '';
                    if(p.type === 'httpGet') {
                        probeYaml += `\n      httpGet:\n        path: ${p.path || '/'}\n        port: ${p.port || 80}`;
                    } else if(p.type === 'tcpSocket') {
                        probeYaml += `\n      tcpSocket:\n        port: ${p.port || 80}`;
                    } else if(p.type === 'exec') {
                        probeYaml += `\n      exec:\n        command: [${p.command.map(cmd => `"${cmd}"`).join(', ')}]`;
                    }
                    if(p.initialDelaySeconds) probeYaml += `\n      initialDelaySeconds: ${p.initialDelaySeconds}`;
                    if(p.periodSeconds) probeYaml += `\n      periodSeconds: ${p.periodSeconds}`;
                    if(p.timeoutSeconds) probeYaml += `\n      timeoutSeconds: ${p.timeoutSeconds}`;
                    if(p.failureThreshold) probeYaml += `\n      failureThreshold: ${p.failureThreshold}`;
                    yaml += probeYaml;
                 });
            }

            // VOLUME MOUNTS
            if (c.volumeMounts.length > 0) {
                yaml += ckadComment('コンテナ内にボリュームをマウントする設定', 'volumeMounts');
                yaml += `\n    volumeMounts:`;
                c.volumeMounts.forEach(vm => {
                    yaml += `\n    - name: ${vm.name}\n      mountPath: "${vm.mountPath}"`;
                });
            }

            yamlOutput.value = yaml;
            deployCommand.textContent = `kubectl apply -f ${state.podName}.yaml`;
        } catch (error) {
            yamlOutput.value = `エラーが発生しました:\n${error.stack}`;
            console.error("YAML Generation Error:", error);
        }
    }

    // --- EVENT LISTENERS ---
    form.addEventListener('input', generateYaml);

    document.body.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'add') {
            addDynamicItem(e.target.dataset.type);
            generateYaml();
        }
        if (action === 'remove') {
            removeDynamicItem(e.target);
            generateYaml();
        }
    });

    get('copy-yaml-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(yamlOutput.value).then(() => alert('Copied!'));
    });

    get('save-yaml-btn').addEventListener('click', () => {
        const filename = (get('podName').value || 'pod') + '.yaml';
        const blob = new Blob([yamlOutput.value], { type: 'text/yaml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    });
    
    get('load-nginx-sample').addEventListener('click', () => {
        // Reset form
        form.querySelectorAll('input[type="text"], input[type="number"]').forEach(i => i.value = '');
        form.querySelectorAll('.dynamic-list').forEach(list => list.innerHTML = '');
        
        // Set sample values
        get('podName').value = 'nginx-sample-pod';
        addDynamicItem('labels');
        const labelItem = get('labels-list').querySelector('.dynamic-list-item');
        labelItem.querySelector('.item-key').value = 'app';
        labelItem.querySelector('.item-value').value = 'my-nginx';
        
        get('containerName').value = 'nginx-container';
        get('imageName').value = 'nginx:1.27.1';
        get('res_req_cpu').value = '100m';
        get('res_req_mem').value = '128Mi';
        get('res_lim_cpu').value = '200m';
        get('res_lim_mem').value = '256Mi';
        
        generateYaml();
        alert('Nginx Podのサンプルを読み込みました。');
    });

    // --- INITIALIZATION ---
    initializeProbes();
    generateYaml();
});
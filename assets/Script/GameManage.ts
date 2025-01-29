import { _decorator, AudioClip, AudioSource, Component, EventTouch, instantiate, Label, Node, NodeEventType, Prefab, Sprite, tween, UITransform, v3, Vec2, Vec3 } from 'cc';
import { Tile } from './Tile';
const { ccclass, property } = _decorator;

enum MoveDirect {
    LEFT,
    RIGHT,
    UP,
    DOWN
}

type userInfo  = {
    bestScore:number,
    score:number,
    tilesData:(number | null)[][],
    tileNums:number
}

@ccclass('GameManage')
export class GameManage extends Component {
    // 开始菜单
    @property(Node)
    StartMenu:Node;
    // 结束菜单
    @property(Node)
    OverMenu:Node;
    // 设置菜单
    @property(Node)
    SettingMenu:Node;
    // 块 容器
    @property(Node)
    TileMap:Node;
    // 块 预制体
    @property(Prefab)
    Tile:Prefab;
    // 空白块 预制体
    @property(Prefab)
    Road:Prefab;

    // 游戏标题
    @property(Label)
    GameTitle:Label;
    // 游戏规则
    @property(Label)
    GameRule:Label;

    // 最高分
    @property(Label)
    BestScore:Label;
    // 当前分
    @property(Label)
    Score:Label;

    // 结束面板的当前分
    @property(Label)
    OverScore:Label;
    // 结束面板的最高分
    @property(Label)
    OverBestScore:Label;

    // 音频资源
    @property(AudioClip)
    SoundMove:AudioClip;
    @property(AudioClip)
    SoundMerge:AudioClip;

    private isUseStorage:boolean = false; // 是否使用历史记录

    private audioManage:AudioSource; // 音频管理

    private isGameStarting:boolean = false; // 游戏是否已经开始
    private posStart:Vec2; // 起始点
    private posEnd:Vec2; // 结束点

    private tileNums:number = 4; // 容器容纳块数量
    private tileWidth:number; // 格子的宽度
    private tileMargin:number = 16; // 块间隔
    private tilesData:(Node | null)[][] = []; // 容器内容 null 代表为空白 数字代表为生成的块
    private startPos:Vec3; // 起始点坐标

    // 玩家数据
    userInfoData:userInfo = {
        bestScore: 0,
        score: 0,
        tilesData:[],
        tileNums:4
    }; 

    // 游戏开始时的回调
    start() {
        this.addEventListener();

        this.audioManage = new AudioSource()
        this.audioManage.volume = ( 1 / 100 ) * 1;

        this.StartMenu.active = true;
        this.SettingMenu.active = false;
        this.OverMenu.active = false;
        this.init();
    }

    // 重新开始
    reStart(){
        this.isGameStarting = true;
        this.OverMenu.active = false;
        this.resetStorage();

        this.init();
    }

    // 初始化
    init(){
        const powNum = 10 + this.tileNums - 3;
        this.GameTitle.getComponent(Label).string = (Math.pow(2,powNum)).toString()
        this.GameRule.getComponent(Label).string = `Join the numbers \nto get to ${(Math.pow(2,powNum)).toString()}!` 
        
        // 使用历史记录
        const userInfoDataLocal:string = localStorage.getItem('userInfoData');
        const userInfoData:userInfo | null = userInfoDataLocal ? JSON.parse(userInfoDataLocal) : null
        
        if(this.isUseStorage && userInfoData && userInfoData.tilesData.length > 0){
            this.useStorage();
            this.renderTileMap();
        }else{
            this.initTileMapData();
            this.renderTileMap();
            this.createTile();
            
        }
    }
    
    // 初始化块地图数据
    initTileMapData(){
        this.tilesData = [];
        for (let rowIdx = 0; rowIdx < this.tileNums; rowIdx++) {
            this.tilesData[rowIdx] = [];
            for (let colIdx = 0; colIdx < this.tileNums; colIdx++) {
                this.tilesData[rowIdx][colIdx] = null;
            }
        }
    }

    // 渲染块地图视图
    renderTileMap(){
        // 清理之前所有的块
        this.TileMap.removeAllChildren();
        const tileMapUI:UITransform = this.TileMap.getComponent(UITransform);
        // 块容器宽度
        const tileMapWidth = tileMapUI.width; 
        // 块宽度
        this.tileWidth = (tileMapWidth - this.tileMargin * ( this.tileNums + 1 )) / this.tileNums
        // 起始点坐标
        const offsetX = - tileMapWidth / 2 + this.tileWidth / 2 + this.tileMargin;
        const offsetY = tileMapWidth / 2 - this.tileWidth / 2 - this.tileMargin;
        // 0,0点是整个节点的中心点,如果以左上角顶点 作为为中心点 获取真实的位移值
        // x 轴对比 原中心点 为 -( 地图宽的一半 + 块宽的一半 + 间隔 )
        // y 轴对比 原中心点 为 +( 地图宽的一半 - 块宽的一半 - 间隔 )
        this.startPos = new Vec3( offsetX, offsetY, 0);
        // 初始化Road
        for (let rowIdx = 0; rowIdx < this.tilesData.length; rowIdx++) {
            for (let colIdx = 0; colIdx < this.tilesData[rowIdx].length; colIdx++) {
                const curPos = new Vec3(colIdx,rowIdx,0)
                this.createRoad(curPos);   
            }
        }
        // 初始化Tile
        for (let rowIdx = 0; rowIdx < this.tilesData.length; rowIdx++) {
            for (let colIdx = 0; colIdx < this.tilesData[rowIdx].length; colIdx++) {
                const curPos = new Vec3(colIdx,rowIdx,0)
                const curItem = this.tilesData[curPos.y][curPos.x];
                // 不为null的情况下
                if(curItem !== null){
                    const curNum = Number(curItem);
                    this.createTile(false,false,curNum,curPos);
                    
                }
            }
        }
        
    }
    
    // 生成 块
    createTile(isAnimated:boolean = true,isRandom: true | false = true, curNum?: number, curPos?:Vec3 ){
        const randomNum = Math.floor(Math.random() * 3) === 0 ? 4 : 2; // 3/1的几率生成一个更大的数字
        const num = isRandom ? randomNum: curNum; // 生成的数字大小
        const roadArr = []; // 空白块的下标
        this.tilesData.forEach( (arr,rowIdx) => {
            arr.forEach((v,colIdx) => {
                if(v === null){
                    roadArr.push(new Vec3(colIdx,rowIdx,0));
                }
            })
        });
        if(roadArr.length <= 0) return; // 如果当前没有空白块则跳出

        const roadIdx = Math.floor(Math.random() * roadArr.length); // 空白块下标
        const roadPos = isRandom ? roadArr[roadIdx] : curPos; // 随机的空白块的坐标
       
        const node = instantiate(this.Tile);
        const tile = node.getComponent(Tile)
        tile.init(num)

        this.tilesData[roadPos.y][roadPos.x] = node; // 将目标的空白块重新赋值

        const tileUI:UITransform = node.getComponent(UITransform);
        tileUI.width = this.tileWidth;
        tileUI.height = this.tileWidth;

        const tilePos = this.getRealPosition(roadPos);
        node.position = tilePos;
        node.parent = this.TileMap;
        // 播放动画
        if(isAnimated){
            node.scale = v3(0.5,0.5,0.5);
            tween(node).to(0.1,{ scale:v3(1,1,1) }, { easing:'sineInOut' }).start();
        }
    }

    // 生成 空白块
    createRoad(curPos:Vec3){
        const node = instantiate(this.Road);
        const tileUI:UITransform = node.getComponent(UITransform);
        tileUI.width = this.tileWidth;
        tileUI.height = this.tileWidth;

        const tilePos = this.getRealPosition(curPos);
        node.position = tilePos;
        node.parent = this.TileMap;
    }

    // 开始游戏
    startGame(){
        this.isGameStarting = true;
        this.StartMenu.active = false;
    }

    // 打开游戏设置
    openGameSetting(){
        this.SettingMenu.active = true;
    }

    // 切换游戏类型
    changeGameType(evt:EventTouch,customEventData:number){
        this.userInfoData.tileNums = Number(customEventData);
        this.tileNums = Number(customEventData);
        this.SettingMenu.active = false;
        this.resetStorage();
        this.init();
    }

    // 返回游戏
    backGame(){
        this.SettingMenu.active = false;
    }

    // 返回主页面
    backHome(){
        this.SettingMenu.active = false;
        this.StartMenu.active = true;
    }

    // 添加事件监听
    private addEventListener(){
        this.node.on(NodeEventType.TOUCH_START,this.onTouchStart,this);
        this.node.on(NodeEventType.TOUCH_END,this.onTouchEnd,this);
    }

    // 点击开始
    private onTouchStart(evt:EventTouch){
        if(this.isGameStarting === false) return;
        this.posStart = evt.getLocation()
    }

    // 点击结束
    private onTouchEnd(evt:EventTouch){
        if(this.isGameStarting === false) return;

        this.posEnd = evt.getLocation();
        // 计算 x,y 轴偏移量
        const offsetX = this.posStart.x - this.posEnd.x
        const offsetY = this.posStart.y - this.posEnd.y

        const absOffsetX = Math.abs(offsetX);
        const absOffsetY = Math.abs(offsetY);
        if(absOffsetX < 40 && absOffsetY < 40) return; // 偏移量太小,不计入操作

        // 判断是x轴的移动，还是y轴的移动
        if(absOffsetX > absOffsetY){
            // 大于0的时候是向右移动,否则是向左
            if(offsetX > 0){
                this.tileMove(MoveDirect.LEFT)
            }else{
                this.tileMove(MoveDirect.RIGHT)
            }
        }else{
            // 大于0的时候是向右移动,否则是向左
            if(offsetY > 0){
                this.tileMove(MoveDirect.DOWN)
            }else{
                this.tileMove(MoveDirect.UP)
            }
        }
    }

    // 块移动 运算块合并后结果
    private tileMove(type:MoveDirect){
        let isMoved = false; // 是否合成过
        let isMerged = false; // 是否移动过
        if(type === MoveDirect.LEFT){
            let isCreateTile = false; // 是否已经创建过块
            // rowIdx 代表的是y轴 ; colIdx 代表的是x轴
            for (let rowIdx = 0; rowIdx < this.tilesData.length; rowIdx++) {
                let merged = new Array(this.tilesData.length).fill(false);// 当前行/列的元素是否已经进行过合并
                for (let colIdx = 0; colIdx <  this.tilesData[rowIdx].length; colIdx++) {
                    // 当前节点
                    const curItem = this.tilesData[rowIdx][colIdx];
                    // 当前节点 不为空 且 不处于边界
                    if(curItem !== null && colIdx !== 0 ){
                        // 可移动的 目标空白块 下标
                        const endRoadColIdx = this.tilesData[rowIdx].findIndex( (v,i) => v === null && i < colIdx );
                        // 当前节点的数字
                        const curNum = + curItem.getComponent(Tile).TileLable.string; 
                        // 可合并的 目标块 下标
                        let endTileColIdx = -1;
                        for (let i = this.tilesData[rowIdx].length - 1; i >= 0; i--) {
                            let v = this.tilesData[rowIdx][i];
                            if (v !== null && i < colIdx) {
                                if(+(v.getComponent(Tile).TileLable.string) === curNum) endTileColIdx = i;
                                // 找到后 只确定一次
                                break; 
                            }
                        }
                        // 是否可以找到合并目标的下标 并且 当前位置并没有发生过合并
                        let isMerge = endTileColIdx !== -1 && !merged[endTileColIdx]; // 当前元素是否可以合并
                        let isMove = endRoadColIdx !== -1; // 当前元素是否可以移动
                        if(isMerge) isMerged = true;
                        if(isMove) isMoved = true;
                        if(isMerge || isMove){
                            // 目标点下标
                            const endColIdx = isMerge ? endTileColIdx : endRoadColIdx
                            const tarTilePos = new Vec3(endColIdx,rowIdx,0);// 目标 块 坐标
                            const movePos = this.getRealPosition(tarTilePos); // 目标点真实坐标
                            const tarItem = this.tilesData[rowIdx][endColIdx];

                            // 动画执行完毕后 删除目标元素 然后再生成新的元素
                            
                            this.playTileMoveAnime(curItem,movePos,()=> {
                                if(isMerge){
                                    tarItem.destroy();
                                }
                                if(!isCreateTile){
                                    this.createTile();
                                    isCreateTile = true;
                                }
                            });
                            
                            // 移动完成后需要更改其位置
                            this.tilesData[rowIdx][endColIdx] = curItem;
                            this.tilesData[rowIdx][colIdx] = null;
                            if(isMerge){
                                // 计算得分
                                this.setScore(curNum);
                                // 合并元素(当前元素数值 x 2)
                                const num = curNum * 2
                                const curTile = curItem.getComponent(Tile)
                                curTile.init(num);
                                // 目标位置发生了合并
                                merged[endColIdx] = true
                                // 播放合成后动画
                                this.playTileMergeAnime(curItem);
                            }
                        }
                    }
                }
            }
        }else if(type === MoveDirect.RIGHT){
            let isCreateTile = false;
            for (let rowIdx = 0; rowIdx < this.tilesData.length; rowIdx++) {
                let merged = new Array(this.tilesData.length).fill(false);
                for (let colIdx = this.tilesData[rowIdx].length - 1; colIdx >= 0; colIdx--) {
                    const curItem = this.tilesData[rowIdx][colIdx];
                    if(curItem !== null && colIdx !== this.tileNums ){
                        const endRoadColIdx = this.tilesData[rowIdx].findLastIndex( (v,i) => v === null && i > colIdx );
                        const curNum = + curItem.getComponent(Tile).TileLable.string; 
                        let endTileColIdx = -1;
                        for (let i = 0; i < this.tilesData[rowIdx].length; i++) {
                            let v = this.tilesData[rowIdx][i];
                            if (v !== null && i > colIdx) {
                                if(+(v.getComponent(Tile).TileLable.string) === curNum){
                                    endTileColIdx = i;
                                }
                                break;
                            }
                        }
                        let isMerge = endTileColIdx !== -1 && !merged[endTileColIdx];
                        let isMove = endRoadColIdx !== -1;
                        if(isMerge){
                            isMerged = true
                        }
                        if(isMove){
                            isMoved = true
                        }
                        if(isMerge || isMove){
                            const endColIdx = isMerge ? endTileColIdx : endRoadColIdx
                            const tarTilePos = new Vec3(endColIdx,rowIdx,0);
                            const movePos = this.getRealPosition(tarTilePos);
                            const tarItem = this.tilesData[rowIdx][endColIdx];
                            this.playTileMoveAnime(curItem,movePos,()=> {
                                if(isMerge){
                                    tarItem.destroy();
                                }
                                if(!isCreateTile){
                                    this.createTile();
                                    isCreateTile = true;
                                }
                            });
                            this.tilesData[rowIdx][endColIdx] = curItem;
                            this.tilesData[rowIdx][colIdx] = null;
                            if(isMerge){
                                this.setScore(curNum);
                                const num = curNum * 2
                                const curTile = curItem.getComponent(Tile)
                                curTile.init(num)
                                merged[endColIdx] = true
                                this.playTileMergeAnime(curItem);
                            }
                        }
                    }
                }
            }
        }else if(type === MoveDirect.UP){
            let isCreateTile = false;
            for (let colIdx = 0; colIdx < this.tilesData[0].length; colIdx++) {
                let merged = new Array(this.tilesData[0].length).fill(false);
                for (let rowIdx = 0; rowIdx < this.tilesData.length ; rowIdx++) {
                    const curItem = this.tilesData[rowIdx][colIdx];
                    if(curItem !== null && rowIdx !== 0 ){
                        // 可移动的 目标空白块 下标
                        const endRoadRowIdx = this.tilesData.findIndex( (subArray,i)=> subArray[colIdx] === null && i < rowIdx ); // * < findIndex *
                        // 当前节点的数字
                        const curNum = + curItem.getComponent(Tile).TileLable.string;

                        // 可合并的 目标块 下标
                        let endTileRowIdx = -1;
                        for (let i = this.tilesData.length - 1; i >= 0 ; i--) { // *i顺序*
                            let v = this.tilesData[i][colIdx];
                            if (v !== null && i < rowIdx) { // * < *
                                if(+(v.getComponent(Tile).TileLable.string) === curNum){
                                    endTileRowIdx = i;
                                }
                                break; // 找到后只确定一次
                            }
                        }

                        let isMerge = endTileRowIdx !== -1 && !merged[endTileRowIdx]; // 是否可以合并
                        let isMove = endRoadRowIdx !== -1; // 是否可以移动
                        if(isMerge){
                            isMerged = true
                        }
                        if(isMove){
                            isMoved = true
                        }
                        if(isMerge || isMove){
                            // 目标点下标
                            const endRowIdx = isMerge ? endTileRowIdx : endRoadRowIdx
                            
                            const tarTilePos = new Vec3(colIdx,endRowIdx,0);// 目标 块 坐标

                            const movePos = this.getRealPosition(tarTilePos); // 目标点真实坐标
                            const tarItem = this.tilesData[endRowIdx][colIdx]
                            
                            // 动画执行完毕后 删除目标元素 然后再生成新的元素
                            this.playTileMoveAnime(curItem,movePos,()=> {
                                if(isMerge){
                                    tarItem.destroy();
                                }
                                if(!isCreateTile){
                                    this.createTile();
                                    isCreateTile = true;
                                }
                            });
                            // 移动完成后需要更改其位置
                            this.tilesData[endRowIdx][colIdx] = curItem;
                            this.tilesData[rowIdx][colIdx] = null;
                            if(isMerge){
                                this.setScore(curNum);
                                // 合并元素(当前元素数值 x 2)
                                const num = curNum * 2
                                const curTile = curItem.getComponent(Tile);
                                curTile.init(num);
                                // 目标位置发生了合并
                                merged[endRowIdx] = true;

                                this.playTileMergeAnime(curItem);
                            }
                        }
                    }
                }
            }
        }else if(type === MoveDirect.DOWN){
            let isCreateTile = false;
            for (let colIdx = 0; colIdx < this.tilesData[0].length; colIdx++) {
                let merged = new Array(this.tilesData[0].length).fill(false);
                for (let rowIdx = this.tilesData.length - 1; rowIdx >= 0; rowIdx--) {
                    const curItem = this.tilesData[rowIdx][colIdx];
                    if(curItem !== null && rowIdx !== this.tileNums ){ // * 修改边界判断坐标 *
                        // 可移动的 目标空白块 下标
                        const endRoadRowIdx = this.tilesData.findLastIndex( (subArray,i)=> subArray[colIdx] === null && i > rowIdx ); // * > *
                        // 当前节点的数字
                        const curNum = + curItem.getComponent(Tile).TileLable.string;
                        // 可合并的 目标块 下标
                        let endTileRowIdx = -1;
                        for (let i = 0; i < this.tilesData.length; i++) { // *i顺序*
                            let v = this.tilesData[i][colIdx]; // * 调换了顺序 *
                            if (v !== null && i > rowIdx) { // * > *
                                if(+(v.getComponent(Tile).TileLable.string) === curNum){
                                    endTileRowIdx = i;
                                }
                                break; // 找到后只确定一次
                            }
                        }
                        let isMerge = endTileRowIdx !== -1 && !merged[endTileRowIdx]; // 是否可以合并
                        let isMove = endRoadRowIdx !== -1; // 是否可以移动
                        if(isMerge){
                            isMerged = true
                        }
                        if(isMove){
                            isMoved = true
                        }
                        if(isMerge || isMove){
                            // 目标点下标
                            const endRowIdx = isMerge ? endTileRowIdx : endRoadRowIdx
                            const tarTilePos = new Vec3(colIdx,endRowIdx,0);// 目标 块 坐标
                            const movePos = this.getRealPosition(tarTilePos); // 目标点真实坐标
                            const tarItem = this.tilesData[endRowIdx][colIdx];
                            
                            // 动画执行完毕后 删除目标元素 然后再生成新的元素
                            this.playTileMoveAnime(curItem,movePos,()=> {
                                if(isMerge){
                                    tarItem.destroy();
                                }
                                if(!isCreateTile){
                                    this.createTile();
                                    isCreateTile = true;
                                }
                            });

                            // 移动完成后需要更改其位置
                            this.tilesData[endRowIdx][colIdx] = curItem;
                            this.tilesData[rowIdx][colIdx] = null;
                            if(isMerge){
                                // 计算得分
                                this.setScore(curNum);
                                // 合并元素(当前元素数值 x 2)
                                const num = curNum * 2
                                const curTile = curItem.getComponent(Tile)
                                curTile.init(num)
                                // 目标位置发生了合并
                                merged[endRowIdx] = true

                                this.playTileMergeAnime(curItem);
                            }
                        }
                    }
                }
            }
        }
        if(isMerged){
            // 播放音频
            this.playSound(this.SoundMerge);
        }else if(isMoved){
            // 播放音频
            this.playSound(this.SoundMove);
        }
        // 保存游戏记录
        if(this.isUseStorage){
            // 存在一个合成动画的延时，所以延迟500ms保存
            setTimeout(()=>{
                this.saveStorage();
            },500)
        }
        // 先判断游戏是否结束
        this.isGameOver();
    }

    // 块移动动画
    private playTileMoveAnime(tile:Node,tarPos:Vec3,callback?:Function){
        tween(tile)
        .to(0.1, { position:tarPos }, { easing: 'sineIn' })
        .call(callback)
        .start();
    }

    // 块合成动画
    private playTileMergeAnime( node:Node ){
        tween(node)
        .to(0.1, { scale: new Vec3(0.9, 0.9, 1) }, { easing: 'quadIn' })
        .to(0.15, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'quadOut' })
        .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'elasticOut' })
        .start();
    }

    // 获取实际的位置
    private getRealPosition(curPos:Vec3){
        
        const x = this.startPos.x + this.tileWidth * curPos.x + this.tileMargin * curPos.x; // x起始点 + 块宽度 * x轴坐标(个数) + 间隔宽度 * x轴坐标(个数)
        const y = this.startPos.y - this.tileWidth * curPos.y - this.tileMargin * curPos.y; // y起始点 - 块宽度 * x轴坐标(个数) - 间隔宽度 * x轴坐标(个数)
        return new Vec3( x, y, 0 );
    }

    // 设置分数
    private setScore(num:number){
        this.userInfoData.score += num;
        this.Score.getComponent(Label).string = this.userInfoData.score.toString();

        if(this.userInfoData.score > this.userInfoData.bestScore){
            this.userInfoData.bestScore += num;
            this.BestScore.getComponent(Label).string = this.userInfoData.bestScore.toString()
        }
    }

    // 游戏是否结束
    private isGameOver(){
        let isOver = true

        // 是否存在可以移动格子
        for (let i = 0; i < this.tilesData.length; i++) {
            for (let j = 0; j < this.tilesData[i].length; j++) {
                if (this.tilesData[i][j] === null) isOver = false;
            }
        }

        // 向左是否可以合并
        for (let rowIdx = 0; rowIdx < this.tilesData.length; rowIdx++) {
            for (let colIdx = 0; colIdx < this.tilesData[rowIdx].length; colIdx++) {
                const curItem = this.tilesData[rowIdx][colIdx]; // 当前节点
                const boundaryPos = 0;
                if(curItem !== null && colIdx !== boundaryPos ){
                    // 当前节点的数字
                    const curNum = + curItem.getComponent(Tile).TileLable.string; 
                    // 可合并的 目标块 下标
                    // let endTileColIdx = -1;
                    for (let i = this.tilesData[rowIdx].length - 1; i >= 0; i--) {
                        let v = this.tilesData[rowIdx][i];
                        if (v !== null && i < colIdx) {
                            if(+(v.getComponent(Tile).TileLable.string) === curNum){
                                // endTileColIdx = i;
                                isOver = false;
                            }
                            break;
                        }
                    }
                }
            }
        }

        // 向上是否可以合并
        for (let colIdx = 0; colIdx < this.tilesData[0].length; colIdx++) {
            for (let rowIdx = 0; rowIdx < this.tilesData.length ; rowIdx++) {
                const curItem = this.tilesData[rowIdx][colIdx];
                const boundaryPos = 0;
                if(curItem !== null && rowIdx !== boundaryPos ){
                    const curNum = + curItem.getComponent(Tile).TileLable.string;
                    // 可合并的 目标块 下标
                    // let endTileRowIdx = -1;
                    for (let i = this.tilesData.length - 1; i >= 0 ; i--) {
                        let v = this.tilesData[i][colIdx];
                        if (v !== null && i < rowIdx) {
                            if(+(v.getComponent(Tile).TileLable.string) === curNum){
                                // endTileRowIdx = i;
                                isOver = false;
                            }
                            break; // 找到后只确定一次
                        }
                    }
                }
            }
        }

        if(isOver){
            console.log('Game Over');
            this.OverBestScore.getComponent(Label).string = this.userInfoData.bestScore.toString()
            this.OverScore.getComponent(Label).string = this.userInfoData.score.toString()

            this.isGameStarting = false;
            this.OverMenu.active = true;
            this.OverMenu.scale = new Vec3(0,0,0)
            tween(this.OverMenu)
            .delay(0.1)
            .to(0.6,{ scale:v3(1,1,1) },{ easing:'sineInOut' })
            .start()
        }
    }

    playSound(audio:AudioClip){
        this.audioManage.playOneShot(audio) 
    }

    // 保存历史数据
    saveStorage(){
        const tilesData = this.tilesData.map( arr => {
            return arr.map( node => node ? +node.getComponent(Tile).TileLable.string : null )
        })
        this.userInfoData.tilesData = tilesData
        const userInfoData = JSON.stringify(this.userInfoData)
        localStorage.setItem('userInfoData',userInfoData)
    }

    // 重置历史记录
    resetStorage(){
        this.userInfoData.score = 0;
        this.userInfoData.tilesData = [];
        this.Score.getComponent(Label).string = "0";

        const userInfoData = JSON.stringify(this.userInfoData)
        localStorage.setItem('userInfoData',userInfoData)
    }

    // 使用历史数据
    useStorage(){
        const userInfoDataLocal:string = localStorage.getItem('userInfoData');
        if(userInfoDataLocal){
            const userInfoData = JSON.parse(userInfoDataLocal)
            this.tileNums = userInfoData.tileNums;
            this.tilesData = userInfoData.tilesData;
            this.setScore(userInfoData.score);
        }
    }

    // 删除历史数据
    removeStorage(){
        
        localStorage.removeItem('userInfoData');
    }
}
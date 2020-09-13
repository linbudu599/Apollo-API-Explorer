import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export default class Counter {
  @Field()
  value!: number;
}
